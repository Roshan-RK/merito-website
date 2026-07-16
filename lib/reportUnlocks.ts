import { getSupabaseServerClient } from "@/lib/supabase";

export async function unlockReport(userId: string, roleTitle: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("report_unlocks")
    .upsert({ user_id: userId, role_title: roleTitle }, { onConflict: "user_id,role_title" });

  if (error) {
    throw new Error(`Failed to unlock report: ${error.message}`);
  }
}

export async function isReportUnlocked(userId: string, roleTitle: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_unlocks")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role_title", roleTitle)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check report unlock status: ${error.message}`);
  }

  return Boolean(data);
}
