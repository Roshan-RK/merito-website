import { getSupabaseServerClient } from "@/lib/supabase";
import { normalizeLinkedinUrl, LINKEDIN_URL_PATTERN } from "@/lib/linkedinUrl";
import { upsertContactDetailRequest } from "@/lib/contactDetailRequests";
import { sendRecruiterViewedEmail } from "@/lib/recruiterViewEmails";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  let body: { linkedinUrl?: unknown };
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

  const { data: leads } = await admin
    .from("fitment_leads")
    .select("role_title, name, email")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const lead = leads?.[0] as { role_title?: string; name?: string; email?: string } | undefined;

  const result = await upsertContactDetailRequest(userId, normalized, lead?.role_title ?? null);

  if (result.isNewOrReset && lead?.email) {
    try {
      await sendRecruiterViewedEmail(lead.email, lead.name || "there");
    } catch (err) {
      console.error("Failed to send contact-request email", err);
    }
  }

  return Response.json({ status: result.status });
}
