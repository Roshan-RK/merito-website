import { getSupabaseServerClient } from "@/lib/supabase";

export async function logAndGetContactEmail(
  userId: string,
  linkedinUrl: string,
  roleTitle: string | null
): Promise<string | null> {
  const admin = getSupabaseServerClient();

  const { data: leads } = await admin
    .from("fitment_leads")
    .select("email")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const email = leads?.[0]?.email as string | undefined;
  if (!email) return null;

  const nowIso = new Date().toISOString();
  const { data: existing } = await admin.from("contact_detail_requests").select("id").eq("user_id", userId).maybeSingle();

  const patch = {
    linkedin_url: linkedinUrl,
    role_title: roleTitle,
    status: "approved" as const,
    requested_at: nowIso,
    decided_at: nowIso,
    decided_by: "auto",
  };
  const { error } = existing
    ? await admin.from("contact_detail_requests").update(patch).eq("id", existing.id as string)
    : await admin.from("contact_detail_requests").insert({ user_id: userId, ...patch });
  if (error) {
    console.error(`Failed to log contact detail reveal: ${error.message}`);
  }

  return email;
}
