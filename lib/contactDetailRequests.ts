import { getSupabaseServerClient } from "@/lib/supabase";

const PAGE_SIZE = 20;

export type ContactDetailRequestRow = {
  id: string;
  userId: string;
  candidateEmail: string;
  linkedinUrl: string;
  roleTitle: string | null;
  status: string;
  requestedAt: string;
  decidedBy: string | null;
};

export type PaginatedContactDetailRequests = { rows: ContactDetailRequestRow[]; total: number; totalPages: number; page: number };

export async function listContactDetailRequests(page: number = 1): Promise<PaginatedContactDetailRequests> {
  const supabase = getSupabaseServerClient();

  const { count } = await supabase.from("contact_detail_requests").select("id", { count: "exact", head: true });
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * PAGE_SIZE;

  const { data: rows } = await supabase
    .from("contact_detail_requests")
    .select("id, user_id, linkedin_url, role_title, status, requested_at, decided_by")
    .order("requested_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string))];
  const { data: leadRows } = userIds.length
    ? await supabase.from("fitment_leads").select("user_id, email").in("user_id", userIds)
    : { data: [] as { user_id: string; email: string }[] };
  const emailByUser = new Map((leadRows ?? []).map((l) => [l.user_id, l.email]));

  return {
    rows: (rows ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      candidateEmail: emailByUser.get(r.user_id) ?? "—",
      linkedinUrl: r.linkedin_url,
      roleTitle: r.role_title,
      status: r.status,
      requestedAt: r.requested_at,
      decidedBy: r.decided_by,
    })),
    total,
    totalPages,
    page: clampedPage,
  };
}

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
