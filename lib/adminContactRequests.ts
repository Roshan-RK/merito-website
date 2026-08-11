import { getSupabaseServerClient } from "@/lib/supabase";

export type ContactRequestStatus = "pending" | "approved" | "denied";

export type ContactRequestRow = {
  id: string;
  userId: string;
  email: string;
  linkedinUrl: string;
  roleTitle: string | null;
  status: ContactRequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
};

export const ALLOWED_TRANSITIONS: Record<ContactRequestStatus, ContactRequestStatus[]> = {
  pending: ["approved", "denied"],
  approved: ["denied"],
  denied: ["approved"],
};

async function emailByUserId(supabase: ReturnType<typeof getSupabaseServerClient>, userIds: string[]): Promise<Map<string, string>> {
  const { data: leadRows } = await supabase.from("fitment_leads").select("user_id, email").in("user_id", userIds);
  const emailByUser = new Map<string, string>();
  for (const lead of leadRows ?? []) {
    emailByUser.set(lead.user_id as string, lead.email as string);
  }
  return emailByUser;
}

function toRow(raw: Record<string, unknown>, email: string): ContactRequestRow {
  return {
    id: raw.id as string,
    userId: raw.user_id as string,
    email,
    linkedinUrl: raw.linkedin_url as string,
    roleTitle: (raw.role_title as string | null) ?? null,
    status: raw.status as ContactRequestStatus,
    requestedAt: raw.requested_at as string,
    decidedAt: (raw.decided_at as string | null) ?? null,
    decidedBy: (raw.decided_by as string | null) ?? null,
  };
}

export async function listContactRequests(): Promise<ContactRequestRow[]> {
  const supabase = getSupabaseServerClient();

  const { data: rows } = await supabase
    .from("contact_detail_requests")
    .select("id, user_id, linkedin_url, role_title, status, requested_at, decided_at, decided_by")
    .order("requested_at", { ascending: true });

  const emailByUser = await emailByUserId(supabase, (rows ?? []).map((r) => r.user_id as string));

  return (rows ?? []).map((r) => toRow(r as Record<string, unknown>, emailByUser.get(r.user_id as string) ?? "—"));
}

export async function getContactRequest(id: string): Promise<ContactRequestRow | null> {
  const supabase = getSupabaseServerClient();

  const { data: row } = await supabase
    .from("contact_detail_requests")
    .select("id, user_id, linkedin_url, role_title, status, requested_at, decided_at, decided_by")
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;

  const emailByUser = await emailByUserId(supabase, [row.user_id as string]);
  return toRow(row as Record<string, unknown>, emailByUser.get(row.user_id as string) ?? "—");
}

export async function updateContactRequestStatus(id: string, status: "approved" | "denied", decidedBy: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("contact_detail_requests")
    .update({ status, decided_at: new Date().toISOString(), decided_by: decidedBy })
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to update contact detail request: ${error.message}`);
  }
}
