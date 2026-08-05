import { getSupabaseServerClient } from "@/lib/supabase";

export type LookupRow = {
  id: string;
  email: string | null;
  createdAt: string;
};

export type LookupStats = {
  totalLookups: number;
  matchedLookups: number;
  last30DaysLookups: number;
};

export async function getLookupStats(): Promise<LookupStats> {
  const supabase = getSupabaseServerClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: totalLookups }, { count: matchedLookups }, { count: last30DaysLookups }] = await Promise.all([
    supabase.from("extension_lookups").select("*", { count: "exact", head: true }),
    supabase.from("extension_lookups").select("*", { count: "exact", head: true }).not("matched_user_id", "is", null),
    supabase.from("extension_lookups").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
  ]);

  return {
    totalLookups: totalLookups ?? 0,
    matchedLookups: matchedLookups ?? 0,
    last30DaysLookups: last30DaysLookups ?? 0,
  };
}

export async function listRecentLookups(limit = 50): Promise<LookupRow[]> {
  const supabase = getSupabaseServerClient();

  const { data: rows } = await supabase
    .from("extension_lookups")
    .select("id, matched_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const matchedUserIds = (rows ?? []).map((r) => r.matched_user_id).filter((id): id is string => id !== null);

  const emailByUser = new Map<string, string>();
  if (matchedUserIds.length > 0) {
    const { data: leadRows } = await supabase.from("fitment_leads").select("user_id, email").in("user_id", matchedUserIds);
    for (const lead of leadRows ?? []) {
      emailByUser.set(lead.user_id, lead.email);
    }
  }

  return (rows ?? []).map((r) => ({
    id: r.id,
    email: r.matched_user_id ? (emailByUser.get(r.matched_user_id) ?? "—") : null,
    createdAt: r.created_at,
  }));
}
