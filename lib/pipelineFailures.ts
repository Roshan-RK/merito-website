import { getSupabaseServerClient } from "@/lib/supabase";
import { logAdminAction } from "@/lib/adminAuditLog";

export type PipelineFailureKind = "interview_invite_after_payment" | "orphaned_ib_job" | "interview_invite_failed";

export type PipelineFailureRow = {
  id: string;
  kind: PipelineFailureKind;
  userId: string | null;
  leadId: string | null;
  orderId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
};

export async function recordPipelineFailure(params: {
  kind: PipelineFailureKind;
  userId: string | null;
  leadId: string | null;
  orderId: string | null;
  detail: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("pipeline_failures").insert({
    kind: params.kind,
    user_id: params.userId,
    lead_id: params.leadId,
    order_id: params.orderId,
    detail: params.detail,
  });
  if (error) {
    console.error("Failed to record pipeline failure", { params, error });
  }
}

export async function listUnresolvedPipelineFailures(): Promise<PipelineFailureRow[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("pipeline_failures")
    .select("id, kind, user_id, lead_id, order_id, detail, created_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    userId: r.user_id,
    leadId: r.lead_id,
    orderId: r.order_id,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}

export async function retryInterviewFromFailure(failureId: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: failure } = await supabase
    .from("pipeline_failures")
    .select("id, kind, user_id, detail, resolved_at")
    .eq("id", failureId)
    .maybeSingle();

  if (!failure || failure.kind !== "interview_invite_after_payment" || failure.resolved_at) {
    throw new Error("Pipeline failure not found or not eligible for retry.");
  }

  const detail = failure.detail as { roleTitle: string; ibJobId: string; ibAgentId: string; ibCandidateId: string };

  const { error: insertError } = await supabase.from("fitment_interviews").insert({
    user_id: failure.user_id,
    role_title: detail.roleTitle,
    ib_job_id: detail.ibJobId,
    ib_agent_id: detail.ibAgentId,
    ib_candidate_id: detail.ibCandidateId,
    status: "invited",
  });
  if (insertError) {
    throw new Error(`Failed to insert recovered interview: ${insertError.message}`);
  }

  await supabase
    .from("pipeline_failures")
    .update({ resolved_at: new Date().toISOString(), resolved_by: adminEmail })
    .eq("id", failureId);

  await logAdminAction({
    adminEmail,
    action: "pipeline_failure.retry_interview",
    targetType: "candidate",
    targetId: failure.user_id ?? failureId,
    priorValue: null,
    newValue: { failureId, roleTitle: detail.roleTitle },
  });
}

export async function discardPipelineFailure(failureId: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: failure } = await supabase
    .from("pipeline_failures")
    .select("id, kind, user_id, resolved_at")
    .eq("id", failureId)
    .maybeSingle();

  if (!failure || failure.resolved_at) {
    throw new Error("Pipeline failure not found or already resolved.");
  }

  const { error } = await supabase
    .from("pipeline_failures")
    .update({ resolved_at: new Date().toISOString(), resolved_by: adminEmail })
    .eq("id", failureId);
  if (error) {
    throw new Error(`Failed to discard pipeline failure: ${error.message}`);
  }

  await logAdminAction({
    adminEmail,
    action: "pipeline_failure.discard",
    targetType: "candidate",
    targetId: failure.user_id ?? failureId,
    priorValue: null,
    newValue: { failureId, kind: failure.kind },
  });
}
