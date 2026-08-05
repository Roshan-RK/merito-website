import { getSupabaseServerClient } from "@/lib/supabase";

export type CounsellingStatus = "requested" | "scheduled" | "completed" | "cancelled";

export type StatePatch = { status: CounsellingStatus; scheduled_at?: string | null; completed_at?: string | null };

export type CounsellingRequestRow = {
  id: string;
  userId: string;
  email: string;
  orderId: string;
  status: CounsellingStatus;
  requestedAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
  notes: string | null;
};

const ACTIVE_STATUSES: CounsellingStatus[] = ["requested", "scheduled"];

export const ALLOWED_TRANSITIONS: Record<CounsellingStatus, CounsellingStatus[]> = {
  requested: ["scheduled", "cancelled"],
  scheduled: ["completed", "cancelled", "requested"],
  completed: [],
  cancelled: [],
};

export function nextCounsellingState(current: CounsellingStatus, next: CounsellingStatus, now: string): StatePatch {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new Error(`Invalid transition: ${current} -> ${next}`);
  }

  if (current === "requested" && next === "scheduled") {
    return { status: next, scheduled_at: now };
  }
  if (current === "scheduled" && next === "completed") {
    return { status: next, completed_at: now };
  }
  if (current === "scheduled" && next === "requested") {
    return { status: next, scheduled_at: null };
  }
  return { status: next };
}

async function emailByUserId(supabase: ReturnType<typeof getSupabaseServerClient>, userIds: string[]): Promise<Map<string, string>> {
  const { data: leadRows } = await supabase.from("fitment_leads").select("user_id, email").in("user_id", userIds);
  const emailByUser = new Map<string, string>();
  for (const lead of leadRows ?? []) {
    emailByUser.set(lead.user_id, lead.email);
  }
  return emailByUser;
}

export async function listCounsellingRequests(includeAll = false): Promise<CounsellingRequestRow[]> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from("counselling_requests")
    .select("id, user_id, order_id, status, requested_at, scheduled_at, completed_at, notes")
    .order("requested_at", { ascending: true });

  if (!includeAll) {
    query = query.in("status", ACTIVE_STATUSES);
  }

  const { data: rows } = await query;
  const emailByUser = await emailByUserId(supabase, (rows ?? []).map((r) => r.user_id));

  return (rows ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: emailByUser.get(r.user_id) ?? "—",
    orderId: r.order_id,
    status: r.status as CounsellingStatus,
    requestedAt: r.requested_at,
    scheduledAt: r.scheduled_at,
    completedAt: r.completed_at,
    notes: r.notes,
  }));
}

export async function getCounsellingRequest(id: string): Promise<CounsellingRequestRow | null> {
  const supabase = getSupabaseServerClient();

  const { data: row } = await supabase
    .from("counselling_requests")
    .select("id, user_id, order_id, status, requested_at, scheduled_at, completed_at, notes")
    .eq("id", id)
    .maybeSingle();

  if (!row) return null;

  const emailByUser = await emailByUserId(supabase, [row.user_id]);

  return {
    id: row.id,
    userId: row.user_id,
    email: emailByUser.get(row.user_id) ?? "—",
    orderId: row.order_id,
    status: row.status as CounsellingStatus,
    requestedAt: row.requested_at,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    notes: row.notes,
  };
}

export async function updateCounsellingStatus(id: string, patch: StatePatch, notes?: string | null): Promise<void> {
  const supabase = getSupabaseServerClient();

  const updates = notes === undefined ? patch : { ...patch, notes };

  const { error } = await supabase.from("counselling_requests").update(updates).eq("id", id);

  if (error) {
    throw new Error(`Failed to update counselling request: ${error.message}`);
  }
}
