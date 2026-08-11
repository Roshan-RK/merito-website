import { getSupabaseServerClient } from "@/lib/supabase";

const PURGE_AFTER_DAYS = 90;

export async function purgeStaleProspects(): Promise<{ purgedCount: number }> {
  const admin = getSupabaseServerClient();
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("recruiter_sourced_prospects")
    .delete()
    .lt("created_at", cutoff)
    .is("converted_lead_id", null)
    .select("id");

  if (error) {
    throw new Error(`Failed to purge stale prospects: ${error.message}`);
  }

  return { purgedCount: data?.length ?? 0 };
}
