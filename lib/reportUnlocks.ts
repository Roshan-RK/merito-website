import { getSupabaseServerClient } from "@/lib/supabase";

// Keyed on (user_id, lead_id): a report is a per-JD analysis, so two leads
// with the same role_title text must not share one paid unlock. roleTitle is
// still passed (and stored, denormalized) so a row whose lead_id never
// backfilled -- funding txn had its lead_id nulled by a purge -- can still be
// found by the legacy (role_title, lead_id IS NULL) check below.
export async function unlockReport(userId: string, leadId: string, roleTitle: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("report_unlocks")
    .upsert({ user_id: userId, lead_id: leadId, role_title: roleTitle }, { onConflict: "user_id,lead_id" });
  if (error) throw new Error(`Failed to unlock report: ${error.message}`);
}

export async function isReportUnlocked(userId: string, leadId: string, roleTitle: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const byLead = await supabase
    .from("report_unlocks")
    .select("user_id")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (byLead.error) throw new Error(`Failed to check report unlock status: ${byLead.error.message}`);
  if (byLead.data) return true;

  // Legacy: pre-this-migration rows, and rows a purge un-linked, are keyed
  // only by (user_id, role_title) with lead_id NULL.
  const legacy = await supabase
    .from("report_unlocks")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role_title", roleTitle)
    .is("lead_id", null)
    .maybeSingle();
  if (legacy.error) throw new Error(`Failed to check report unlock status: ${legacy.error.message}`);
  return Boolean(legacy.data);
}
