import { getSupabaseServerClient } from "@/lib/supabase";

export type ContactDetailRequestStatus = "pending" | "approved" | "denied";

export type UpsertContactDetailRequestResult = {
  status: ContactDetailRequestStatus;
  isNewOrReset: boolean;
};

export async function upsertContactDetailRequest(
  userId: string,
  linkedinUrl: string,
  roleTitle: string | null
): Promise<UpsertContactDetailRequestResult> {
  const admin = getSupabaseServerClient();

  const { data: existing } = await admin
    .from("contact_detail_requests")
    .select("id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    const { error } = await admin.from("contact_detail_requests").insert({
      user_id: userId,
      linkedin_url: linkedinUrl,
      role_title: roleTitle,
      status: "pending",
    });
    if (error) {
      throw new Error(`Failed to create contact detail request: ${error.message}`);
    }
    return { status: "pending", isNewOrReset: true };
  }

  const status = existing.status as ContactDetailRequestStatus;
  if (status !== "denied") {
    return { status, isNewOrReset: false };
  }

  const { error } = await admin
    .from("contact_detail_requests")
    .update({
      status: "pending",
      linkedin_url: linkedinUrl,
      role_title: roleTitle,
      requested_at: new Date().toISOString(),
      decided_at: null,
      decided_by: null,
    })
    .eq("id", existing.id as string);
  if (error) {
    throw new Error(`Failed to reset contact detail request: ${error.message}`);
  }
  return { status: "pending", isNewOrReset: true };
}

export async function getApprovedContactDetails(userId: string): Promise<{ email: string; phone: string } | null> {
  const admin = getSupabaseServerClient();

  const { data: request } = await admin
    .from("contact_detail_requests")
    .select("status")
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  if (!request) return null;

  const { data: leads } = await admin
    .from("fitment_leads")
    .select("email, phone")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const lead = leads?.[0];
  if (!lead?.email) return null;

  return { email: lead.email as string, phone: (lead.phone as string | null) || "Not specified" };
}
