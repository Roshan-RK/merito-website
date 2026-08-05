import { randomBytes } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";

const TOKEN_BYTES = 32;

export type ShareTokenValidation =
  | { valid: true; userId: string; roleTitle: string; include: string[]; interviewSections: string[] }
  | { valid: false; reason: "not_found" | "revoked" };

export async function createOrUpdateShareLink({
  userId,
  roleTitle,
  include,
  interviewSections,
}: {
  userId: string;
  roleTitle: string;
  include: string;
  interviewSections: string;
}): Promise<{ token: string }> {
  const supabase = getSupabaseServerClient();

  const { data: existing } = await supabase
    .from("report_share_links")
    .select("token")
    .eq("user_id", userId)
    .eq("role_title", roleTitle)
    .maybeSingle();

  if (existing?.token) {
    const { error } = await supabase
      .from("report_share_links")
      .update({ include, interview_sections: interviewSections, revoked_at: null, updated_at: new Date().toISOString() })
      .eq("token", existing.token);
    if (error) {
      throw new Error(`Failed to update share link: ${error.message}`);
    }
    return { token: existing.token };
  }

  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const { error } = await supabase.from("report_share_links").insert({
    token,
    user_id: userId,
    role_title: roleTitle,
    include,
    interview_sections: interviewSections,
  });
  if (error) {
    throw new Error(`Failed to create share link: ${error.message}`);
  }
  return { token };
}

export async function setShareLinkRevoked({
  userId,
  roleTitle,
  revoked,
}: {
  userId: string;
  roleTitle: string;
  revoked: boolean;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("report_share_links")
    .update({ revoked_at: revoked ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("role_title", roleTitle);
  if (error) {
    throw new Error(`Failed to update share link: ${error.message}`);
  }
}

export async function validateShareToken(token: string): Promise<ShareTokenValidation> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_share_links")
    .select("user_id, role_title, include, interview_sections, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, reason: "not_found" };
  }
  if (data.revoked_at) {
    return { valid: false, reason: "revoked" };
  }
  return {
    valid: true,
    userId: data.user_id,
    roleTitle: data.role_title,
    include: data.include.split(",").filter(Boolean),
    interviewSections: data.interview_sections.split(",").filter(Boolean),
  };
}

export async function recordShareLinkView(token: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: existing } = await supabase.from("report_share_links").select("view_count").eq("token", token).maybeSingle();
  if (!existing) return;

  await supabase
    .from("report_share_links")
    .update({ view_count: existing.view_count + 1, last_viewed_at: new Date().toISOString() })
    .eq("token", token);
}

export async function setShareLinkRevokedByToken(token: string, revoked: boolean): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("report_share_links")
    .update({ revoked_at: revoked ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("token", token);
  if (error) {
    throw new Error(`Failed to update share link: ${error.message}`);
  }
}

export async function getShareLink({
  userId,
  roleTitle,
}: {
  userId: string;
  roleTitle: string;
}): Promise<{ token: string; revoked: boolean } | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("report_share_links")
    .select("token, revoked_at")
    .eq("user_id", userId)
    .eq("role_title", roleTitle)
    .maybeSingle();

  if (!data) return null;
  return { token: data.token, revoked: Boolean(data.revoked_at) };
}
