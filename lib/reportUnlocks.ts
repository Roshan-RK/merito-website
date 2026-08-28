import { getSupabaseServerClient } from "@/lib/supabase";

// Keyed on (user_id, lead_id): a report is a per-JD analysis, so two leads
// with the same role_title text must not share one paid unlock. roleTitle is
// still passed (and stored, denormalized) so a row that stays lead_id NULL
// through the migration->deploy window can still be found by the legacy
// (role_title, lead_id IS NULL) check below.
export async function unlockReport(userId: string, leadId: string, roleTitle: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  // Plain insert + swallow 23505 (unique_violation). NOT upsert/onConflict:
  // onConflict cannot target the pre-0065 PK or a partial index (42P10), and
  // an insert that ignores 23505 is correct under BOTH schemas -- it closes
  // the migration->deploy window. Re-finalizing an unlocked order is a no-op.
  const { error } = await supabase
    .from("report_unlocks")
    .insert({ user_id: userId, lead_id: leadId, role_title: roleTitle });
  if (error && error.code !== "23505") {
    throw new Error(`Failed to unlock report: ${error.message}`);
  }
}

export async function isReportUnlocked(userId: string, leadId: string, roleTitle: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const byLead = await supabase
    .from("report_unlocks")
    .select("user_id")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .limit(1)
    .maybeSingle();
  if (byLead.error) throw new Error(`Failed to check report unlock status: ${byLead.error.message}`);
  if (byLead.data) return true;

  // Legacy: rows written role-only during the deploy window are keyed
  // (user_id, role_title) with lead_id NULL.
  const legacy = await supabase
    .from("report_unlocks")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role_title", roleTitle)
    .is("lead_id", null)
    .limit(1)
    .maybeSingle();
  if (legacy.error) throw new Error(`Failed to check report unlock status: ${legacy.error.message}`);
  return Boolean(legacy.data);
}
