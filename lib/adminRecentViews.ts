import { getSupabaseServerClient } from "@/lib/supabase";

export type RecentCandidateView = {
  userId: string;
  email: string;
  name: string | null;
  viewedAt: string;
};

export async function recordCandidateView(adminEmail: string, userId: string, email: string, name: string | null): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("admin_recent_views").upsert(
    {
      admin_email: adminEmail,
      candidate_user_id: userId,
      candidate_email: email,
      candidate_name: name,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "admin_email,candidate_user_id" }
  );
  if (error) {
    throw new Error(`Failed to record candidate view: ${error.message}`);
  }
}

export async function getRecentCandidateViews(adminEmail: string, limit: number = 5): Promise<RecentCandidateView[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("admin_recent_views")
    .select("candidate_user_id, candidate_email, candidate_name, viewed_at")
    .eq("admin_email", adminEmail)
    .order("viewed_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    userId: row.candidate_user_id,
    email: row.candidate_email,
    name: row.candidate_name,
    viewedAt: row.viewed_at,
  }));
}
