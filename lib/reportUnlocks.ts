import { getSupabaseServerClient } from "@/lib/supabase";

export async function unlockReport(userId: string, leadId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("report_unlocks")
    .upsert({ user_id: userId, lead_id: leadId }, { onConflict: "user_id,lead_id" });

  if (error) {
    throw new Error(`Failed to unlock report: ${error.message}`);
  }
}

export async function isReportUnlocked(userId: string, leadId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_unlocks")
    .select("user_id")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check report unlock status: ${error.message}`);
  }

  return Boolean(data);
}
