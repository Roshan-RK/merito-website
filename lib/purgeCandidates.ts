import { getSupabaseServerClient } from "@/lib/supabase";
import { logAdminAction } from "@/lib/adminAuditLog";

const SYSTEM_ACTOR = "system:cron";

// Runs the daily fast-follow to soft-delete (see deleteCandidate in
// adminCandidates.ts): for each candidate_deletions row past its purge_after
// date, erases the candidate's personal-data tables via the
// purge_candidate_data RPC, scrubs the auth.users email, and marks the row
// purged. The auth account itself is never hard-deleted -- razorpay_transactions.user_id
// is not-null and points at it permanently for financial-record retention.
export async function purgeDueCandidateDeletions(): Promise<{ purgedCount: number }> {
  const supabase = getSupabaseServerClient();

  const { data: dueRows, error: dueError } = await supabase
    .from("candidate_deletions")
    .select("user_id")
    .is("purged_at", null)
    .lte("purge_after", new Date().toISOString());
  if (dueError) {
    throw new Error(`Failed to load due candidate deletions: ${dueError.message}`);
  }

  let purgedCount = 0;
  for (const row of dueRows ?? []) {
    const userId = row.user_id;

    const { data: purgedTables, error: rpcError } = await supabase.rpc("purge_candidate_data", {
      target_user_id: userId,
    });
    if (rpcError) {
      throw new Error(`Failed to purge candidate data for ${userId}: ${rpcError.message}`);
    }

    const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
      email: `deleted-${userId}@merito.invalid`,
    });
    if (emailError) {
      throw new Error(`Purged data but failed to scrub email for ${userId}: ${emailError.message}`);
    }

    const { error: markError } = await supabase
      .from("candidate_deletions")
      .update({ purged_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (markError) {
      throw new Error(`Purged data but failed to mark ${userId} as purged: ${markError.message}`);
    }

    await logAdminAction({
      adminEmail: SYSTEM_ACTOR,
      action: "candidate.purge",
      targetType: "candidate",
      targetId: userId,
      priorValue: null,
      newValue: { purgedTables, emailScrubbed: true },
    });

    purgedCount++;
  }

  return { purgedCount };
}
