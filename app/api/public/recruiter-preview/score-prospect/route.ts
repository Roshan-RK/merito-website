import { normalizeLinkedinUrl, LINKEDIN_URL_PATTERN } from "@/lib/linkedinUrl";
import { buildLookupFitment } from "@/lib/recruiterPreview";
import { scoreProspect } from "@/lib/recruiterSourcedProspects";
import type { CandidateLevel } from "@/lib/intervuebox/agents";
import type { ScrapedCandidateFields } from "@/lib/syntheticResume";

export const runtime = "nodejs";
// scoreProspect polls for up to RESCORE_MAX_WAIT_MS (default 90s) waiting
// on IntervueBox -- same latent Vercel-default-timeout issue as the
// rescore route (see comment there). 60s is the ceiling supported on
// every Vercel plan tier.
export const maxDuration = 60;

const MAX_JD_CHARS = 20000;
const VALID_LEVELS: CandidateLevel[] = ["entry", "mid", "senior"];

function deriveRoleLabel(jdText: string): string {
  const firstLine = jdText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : "your role";
}

function isValidCandidateFields(value: unknown): value is ScrapedCandidateFields {
  if (!value || typeof value !== "object") return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.name === "string" &&
    typeof fields.headline === "string" &&
    Array.isArray(fields.experience) &&
    Array.isArray(fields.education) &&
    Array.isArray(fields.skills)
  );
}

export async function POST(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  let body: {
    recruiterEmail?: unknown;
    linkedinUrl?: unknown;
    jdText?: unknown;
    candidateLevel?: unknown;
    candidateFields?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  if (typeof body.recruiterEmail !== "string" || body.recruiterEmail.trim().length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (typeof body.linkedinUrl !== "string" || body.linkedinUrl.trim().length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (typeof body.jdText !== "string" || body.jdText.trim().length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (typeof body.candidateLevel !== "string" || !VALID_LEVELS.includes(body.candidateLevel as CandidateLevel)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (!isValidCandidateFields(body.candidateFields)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const normalized = normalizeLinkedinUrl(body.linkedinUrl.trim());
  if (!LINKEDIN_URL_PATTERN.test(normalized)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const jdText = body.jdText.trim().slice(0, MAX_JD_CHARS);

  const result = await scoreProspect({
    recruiterEmail: body.recruiterEmail.trim(),
    linkedinUrl: normalized,
    jdText,
    candidateLevel: body.candidateLevel as CandidateLevel,
    candidateFields: body.candidateFields,
  });

  if (result.status === "verification_required") {
    return Response.json({ error: "Please confirm your email first.", verificationRequired: true }, { status: 403 });
  }
  if (result.status === "cap_exceeded") {
    return Response.json({ error: "Monthly scoring limit reached." }, { status: 429 });
  }
  if (result.status === "failed") {
    return Response.json({ error: "Something went wrong." }, { status: 502 });
  }

  return Response.json({
    prospectId: result.prospectId,
    fitment: buildLookupFitment(result.report, deriveRoleLabel(jdText)),
  });
}
