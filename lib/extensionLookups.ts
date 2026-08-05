import { getSupabaseServerClient } from "@/lib/supabase";

export async function recordLookup({ linkedinUrl, matchedUserId }: { linkedinUrl: string; matchedUserId: string | null }): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("extension_lookups").insert({ linkedin_url: linkedinUrl, matched_user_id: matchedUserId });
  if (error) {
    console.error(`Failed to record extension lookup: ${error.message}`);
  }
}
