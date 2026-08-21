import { getSupabaseServerClient } from "@/lib/supabase";

export type RecruiterActionRow = {
  id: string;
  recruiterEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: unknown;
  createdAt: string;
};

export type PaginatedRecruiterActions = { rows: RecruiterActionRow[]; total: number; totalPages: number; page: number };

const PAGE_SIZE = 20;

export async function logRecruiterAction(params: {
  recruiterEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  detail?: unknown;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("recruiter_action_log").insert({
    recruiter_email: params.recruiterEmail,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    detail: params.detail ?? null,
  });
  if (error) {
    throw new Error(`Failed to write recruiter action log: ${error.message}`);
  }
}

export async function listRecruiterActions(page: number = 1): Promise<PaginatedRecruiterActions> {
  const supabase = getSupabaseServerClient();

  const { count } = await supabase.from("recruiter_action_log").select("id", { count: "exact", head: true });
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * PAGE_SIZE;

  const { data } = await supabase
    .from("recruiter_action_log")
    .select("id, recruiter_email, action, target_type, target_id, detail, created_at")
    .order("created_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);

  return {
    rows: (data ?? []).map((r) => ({
      id: r.id,
      recruiterEmail: r.recruiter_email,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      detail: r.detail,
      createdAt: r.created_at,
    })),
    total,
    totalPages,
    page: clampedPage,
  };
}
