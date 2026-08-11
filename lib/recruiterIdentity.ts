import { randomBytes } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sendRecruiterVerificationEmail } from "@/lib/recruiterEmails";

const TOKEN_BYTES = 32;
const VERIFICATION_VALIDITY_MINUTES = 30;

export async function requestRecruiterEmailVerification(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const admin = getSupabaseServerClient();
  const token = randomBytes(TOKEN_BYTES).toString("hex");

  const { error } = await admin.from("recruiter_identities").upsert(
    {
      email: normalized,
      verification_token: token,
      verification_sent_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );
  if (error) {
    throw new Error(`Failed to store recruiter verification: ${error.message}`);
  }

  await sendRecruiterVerificationEmail(email.trim(), token);
}

export async function confirmRecruiterEmail(token: string): Promise<{ email: string } | null> {
  const admin = getSupabaseServerClient();
  const { data } = await admin
    .from("recruiter_identities")
    .select("email, verification_sent_at")
    .eq("verification_token", token)
    .maybeSingle();

  if (!data) return null;

  const sentAt = new Date(data.verification_sent_at as string).getTime();
  if (Date.now() - sentAt > VERIFICATION_VALIDITY_MINUTES * 60 * 1000) return null;

  const email = data.email as string;
  const { error } = await admin
    .from("recruiter_identities")
    .update({ verified_at: new Date().toISOString(), verification_token: null })
    .eq("email", email);
  if (error) {
    throw new Error(`Failed to confirm recruiter email: ${error.message}`);
  }

  return { email };
}

export async function isRecruiterEmailVerified(email: string): Promise<boolean> {
  const admin = getSupabaseServerClient();
  const { data } = await admin
    .from("recruiter_identities")
    .select("verified_at")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return Boolean(data?.verified_at);
}
