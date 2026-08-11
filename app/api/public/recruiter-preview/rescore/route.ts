import { getSupabaseServerClient } from "@/lib/supabase";
import { normalizeLinkedinUrl, LINKEDIN_URL_PATTERN } from "@/lib/linkedinUrl";
import { createRateLimiter } from "@/lib/rateLimit";
import { buildLookupFitment } from "@/lib/recruiterPreview";
import { hashJd, getCachedRescore, runRescore, type CandidateForRescore } from "@/lib/recruiterJdRescore";
import type { CandidateLevel } from "@/lib/intervuebox/agents";

export const runtime = "nodejs";
// runRescore polls for up to RESCORE_MAX_WAIT_MS (default 90s) waiting on
// IntervueBox -- without this, Vercel kills the function on its plan
// default (well under that), so the poll loop never gets to write the
// "ready" result even when IntervueBox itself finishes moments later.
// 60s is the ceiling supported on every Vercel plan tier.
export const maxDuration = 60;

const MAX_JD_CHARS = 20000;
const rescoreRateLimit = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

function deriveRoleLabel(jdText: string): string {
  const firstLine = jdText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : "your role";
}

export async function POST(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  let body: { linkedinUrl?: unknown; jdText?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  if (typeof body.linkedinUrl !== "string" || body.linkedinUrl.trim().length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (typeof body.jdText !== "string" || body.jdText.trim().length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const normalized = normalizeLinkedinUrl(body.linkedinUrl.trim());
  if (!LINKEDIN_URL_PATTERN.test(normalized)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const jdText = body.jdText.trim().slice(0, MAX_JD_CHARS);

  const admin = getSupabaseServerClient();
  const { data: settingsRow } = await admin
    .from("recruiter_preview_settings")
    .select("user_id")
    .eq("linkedin_url", normalized)
    .eq("enabled", true)
    .maybeSingle();

  if (!settingsRow) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const userId = settingsRow.user_id as string;
  const jdHash = hashJd(jdText);

  const cached = await getCachedRescore(userId, jdHash);
  if (cached) {
    return Response.json({ fitment: buildLookupFitment(cached, deriveRoleLabel(jdText)) });
  }

  if (!rescoreRateLimit(userId)) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const { data: leads } = await admin
    .from("fitment_leads")
    .select("ib_resume_id, name, email, phone, candidate_level")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const lead = leads?.[0];
  if (!lead?.ib_resume_id) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const candidate: CandidateForRescore = {
    userId,
    ibResumeId: lead.ib_resume_id as string,
    name: (lead.name as string) || "Candidate",
    email: lead.email as string,
    phone: lead.phone as string,
    candidateLevel: (lead.candidate_level as CandidateLevel) || "entry",
  };

  try {
    const report = await runRescore(candidate, jdText, jdHash);
    return Response.json({ fitment: buildLookupFitment(report, deriveRoleLabel(jdText)) });
  } catch (err) {
    console.error("Recruiter JD rescore failed", err);
    return Response.json({ error: "Something went wrong." }, { status: 502 });
  }
}
