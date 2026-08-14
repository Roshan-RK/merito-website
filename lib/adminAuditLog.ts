import { getSupabaseServerClient } from "@/lib/supabase";

export type AuditTargetType = "candidate" | "recruiter";

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
