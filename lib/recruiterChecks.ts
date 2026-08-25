import { getSupabaseServerClient } from "@/lib/supabase";

export const MONTHLY_CHECK_CAP = 10;

function currentMonthStartIso(): string {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return monthStart.toISOString();
}

// Combined pool across prospect checks (recruiter_sourced_prospects) and
// Merito-candidate checks (recruiter_candidate_checks) -- one 10/month cap
// covers both candidate types, not two separate caps.
export async function getMonthlyCheckCount(recruiterEmail: string): Promise<number> {
  const admin = getSupabaseServerClient();
  const email = recruiterEmail.toLowerCase();
  const monthStart = currentMonthStartIso();

  const [prospectResult, candidateResult] = await Promise.all([
    admin
      .from("recruiter_sourced_prospects")
      .select("id", { count: "exact", head: true })
      .eq("recruiter_email", email)
      .gte("created_at", monthStart),
    admin
      .from("recruiter_candidate_checks")
      .select("id", { count: "exact", head: true })
      .eq("recruiter_email", email)
      .gte("created_at", monthStart),
  ]);

  return (prospectResult.count ?? 0) + (candidateResult.count ?? 0);
}

export async function recordCandidateCheck(recruiterEmail: string, userId: string, jdHash: string): Promise<void> {
  const admin = getSupabaseServerClient();
  const { error } = await admin.from("recruiter_candidate_checks").insert({
    recruiter_email: recruiterEmail.toLowerCase(),
    user_id: userId,
    jd_hash: jdHash,
  });
  if (error) {
    console.error("Failed to record recruiter candidate check", error);
  }
}
