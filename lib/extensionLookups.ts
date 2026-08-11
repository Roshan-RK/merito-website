import { getSupabaseServerClient } from "@/lib/supabase";
import { sendRecruiterViewedEmail } from "@/lib/recruiterViewEmails";

const VIEW_EMAIL_DEDUPE_MS = 24 * 60 * 60 * 1000;

export async function recordLookup({ linkedinUrl, matchedUserId }: { linkedinUrl: string; matchedUserId: string | null }): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("extension_lookups").insert({ linkedin_url: linkedinUrl, matched_user_id: matchedUserId });
  if (error) {
    console.error(`Failed to record extension lookup: ${error.message}`);
    return;
  }

  if (matchedUserId) {
    await notifyOnFreshView(matchedUserId);
  }
}

async function notifyOnFreshView(matchedUserId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  // Most recent 2 rows for this candidate: index 0 is the row just inserted
  // above, index 1 (if any) is the prior view we're deduping against.
  const { data: recentLookups } = await supabase
    .from("extension_lookups")
    .select("created_at")
    .eq("matched_user_id", matchedUserId)
    .order("created_at", { ascending: false })
    .limit(2);

  const priorRow = (recentLookups ?? [])[1] as { created_at: string } | undefined;
  if (priorRow) {
    const priorAgeMs = Date.now() - new Date(priorRow.created_at).getTime();
    if (priorAgeMs < VIEW_EMAIL_DEDUPE_MS) return;
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("email, name")
    .eq("user_id", matchedUserId)
    .order("created_at", { ascending: false })
    .limit(1);
  const lead = leads?.[0] as { email?: string; name?: string } | undefined;
  if (!lead?.email) return;

  try {
    await sendRecruiterViewedEmail(lead.email, lead.name || "there");
  } catch (err) {
    console.error("Failed to send recruiter-view email", err);
  }
}
