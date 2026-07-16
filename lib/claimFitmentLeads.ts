import { getSupabaseServerClient } from "@/lib/supabase";

export async function claimFitmentLeads(userId: string, email: string): Promise<{ claimedCount: number }> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("fitment_leads")
    .update({ user_id: userId })
    .ilike("email", email)
    .is("user_id", null)
    .select("id");

  if (error) {
    throw new Error(`Failed to claim fitment leads: ${error.message}`);
  }

  return { claimedCount: data?.length ?? 0 };
}
