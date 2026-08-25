import { getSupabaseServerClient } from "@/lib/supabase";
import { normalizeLinkedinUrl, LINKEDIN_URL_PATTERN } from "@/lib/linkedinUrl";
import { logAndGetContactEmail } from "@/lib/contactDetailRequests";
import { sendRecruiterViewedEmail } from "@/lib/recruiterViewEmails";
import { isRecruiterEmailVerified } from "@/lib/recruiterIdentity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  let body: { linkedinUrl?: unknown; recruiterEmail?: unknown; leadId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  if (typeof body.linkedinUrl !== "string" || body.linkedinUrl.trim().length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const normalized = normalizeLinkedinUrl(body.linkedinUrl.trim());
  if (!LINKEDIN_URL_PATTERN.test(normalized)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  if (typeof body.recruiterEmail !== "string" || body.recruiterEmail.trim().length === 0) {
    return Response.json({ error: "Please confirm your email first.", verificationRequired: true }, { status: 403 });
  }
  if (!(await isRecruiterEmailVerified(body.recruiterEmail.trim()))) {
    return Response.json({ error: "Please confirm your email first.", verificationRequired: true }, { status: 403 });
  }

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

  const requestedLeadId = typeof body.leadId === "string" && body.leadId.trim().length > 0 ? body.leadId.trim() : null;

  const { data: leads } = await admin
    .from("fitment_leads")
    .select("id, role_title, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const candidateLeads = (leads ?? []) as { id: string; role_title?: string; name?: string }[];
  // Only ever matches a lead already scoped to this userId above -- a
  // leadId for someone else's lead, a deleted lead, or an old extension
  // build that never sends one all fall back to the most recent lead.
  const lead = (requestedLeadId ? candidateLeads.find((l) => l.id === requestedLeadId) : undefined) ?? candidateLeads[0];

  const email = await logAndGetContactEmail(userId, normalized, lead?.role_title ?? null);
  if (!email) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  try {
    await sendRecruiterViewedEmail(email, lead?.name || "there");
  } catch (err) {
    console.error("Failed to send contact-reveal email", err);
  }

  return Response.json({ email });
}
