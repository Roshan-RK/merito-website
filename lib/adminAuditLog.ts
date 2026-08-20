import { getSupabaseServerClient } from "@/lib/supabase";

export type AuditTargetType = "candidate" | "recruiter" | "email_template" | "counselling_request" | "interview" | "share_link" | "referee";

const PAGE_SIZE = 20;

export type AdminActionRow = {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  priorValue: unknown;
  newValue: unknown;
  createdAt: string;
};

export type PaginatedAdminActions = { rows: AdminActionRow[]; total: number; totalPages: number; page: number };

export type AdminActivityStats = { last24h: number; last7d: number; last30d: number };

export async function getAdminActivityStats(): Promise<AdminActivityStats> {
  const supabase = getSupabaseServerClient();
  const now = Date.now();
  const since = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: last24h }, { count: last7d }, { count: last30d }] = await Promise.all([
    supabase.from("admin_audit_log").select("id", { count: "exact", head: true }).gte("created_at", since(1)),
    supabase.from("admin_audit_log").select("id", { count: "exact", head: true }).gte("created_at", since(7)),
    supabase.from("admin_audit_log").select("id", { count: "exact", head: true }).gte("created_at", since(30)),
  ]);

  return { last24h: last24h ?? 0, last7d: last7d ?? 0, last30d: last30d ?? 0 };
}

export async function listAdminActions(page: number = 1): Promise<PaginatedAdminActions> {
  const supabase = getSupabaseServerClient();

  const { count } = await supabase.from("admin_audit_log").select("id", { count: "exact", head: true });
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * PAGE_SIZE;

  const { data } = await supabase
    .from("admin_audit_log")
    .select("id, admin_email, action, target_type, target_id, prior_value, new_value, created_at")
    .order("created_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);

  return {
    rows: (data ?? []).map((r) => ({
      id: r.id,
      adminEmail: r.admin_email,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      priorValue: r.prior_value,
      newValue: r.new_value,
      createdAt: r.created_at,
    })),
    total,
    totalPages,
    page: clampedPage,
  };
}

/** Full (unpaginated) history for one target — for showing an "overridden" badge/timeline inline on a detail page, not the paginated global feed. */
export async function listActionsForTarget(targetType: AuditTargetType, targetId: string): Promise<AdminActionRow[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("admin_audit_log")
    .select("id, admin_email, action, target_type, target_id, prior_value, new_value, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    adminEmail: r.admin_email,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    priorValue: r.prior_value,
    newValue: r.new_value,
    createdAt: r.created_at,
  }));
}

export async function logAdminAction(params: {
  adminEmail: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  priorValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("admin_audit_log").insert({
    admin_email: params.adminEmail,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    prior_value: params.priorValue ?? null,
    new_value: params.newValue ?? null,
  });

  if (error) {
    throw new Error(`Failed to write admin audit log: ${error.message}`);
  }
}
