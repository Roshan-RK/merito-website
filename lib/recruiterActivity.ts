import { getSupabaseServerClient } from "@/lib/supabase";

export async function getRecruiterViewCount(userId: string, days = 30): Promise<number> {
  const supabase = getSupabaseServerClient();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("extension_lookups")
    .select("*", { count: "exact", head: true })
    .eq("matched_user_id", userId)
    .gte("created_at", cutoff);

  return count ?? 0;
}
