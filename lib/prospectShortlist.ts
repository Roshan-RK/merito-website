import { randomBytes } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getAbsoluteUrl } from "@/lib/site";

function deriveRoleLabel(jdText: string): string {
  const firstLine = jdText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : "this role";
}

function buildInviteText(candidateName: string | null, roleLabel: string, claimUrl: string): string {
  const name = candidateName || "there";
  return `Hi ${name}, I came across your profile and think you'd be a strong fit for ${roleLabel}. I scored your background with Merito's tool — check out your fit and claim your profile here: ${claimUrl}`;
}

export async function shortlistProspect(prospectId: string): Promise<{ claimUrl: string; inviteText: string } | null> {
  const admin = getSupabaseServerClient();
  const { data } = await admin
    .from("recruiter_sourced_prospects")
    .select("claim_token, candidate_name, jd_text")
    .eq("id", prospectId)
    .maybeSingle();

  if (!data) return null;

  const roleLabel = deriveRoleLabel(data.jd_text as string);
  let token = data.claim_token as string | null;

  if (!token) {
    token = randomBytes(32).toString("hex");
    const { error } = await admin
      .from("recruiter_sourced_prospects")
      .update({ claim_token: token, shortlisted: true, shortlisted_at: new Date().toISOString() })
      .eq("id", prospectId);
    if (error) {
      throw new Error(`Failed to shortlist prospect: ${error.message}`);
    }
  }

  const claimUrl = getAbsoluteUrl(`/claim/${token}`);
  return { claimUrl, inviteText: buildInviteText(data.candidate_name as string | null, roleLabel, claimUrl) };
}
