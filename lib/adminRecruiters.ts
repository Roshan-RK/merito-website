import { getSupabaseServerClient } from "@/lib/supabase";
import { logAdminAction } from "@/lib/adminAuditLog";

export type RecruiterRow = {
  email: string;
  companyName: string | null;
  verifiedAt: string | null;
  bannedAt: string | null;
};

export async function banRecruiter(email: string, adminEmail: string, reason: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("recruiter_identities").update({ banned_at: new Date().toISOString() }).eq("email", email);
  if (error) {
    throw new Error(`Failed to ban recruiter: ${error.message}`);
  }
  await logAdminAction({
    adminEmail,
    action: "recruiter.ban",
    targetType: "recruiter",
    targetId: email,
    priorValue: null,
    newValue: { banned: true, reason },
  });
}

export async function unbanRecruiter(email: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("recruiter_identities").update({ banned_at: null }).eq("email", email);
  if (error) {
    throw new Error(`Failed to unban recruiter: ${error.message}`);
  }
  await logAdminAction({
    adminEmail,
    action: "recruiter.unban",
    targetType: "recruiter",
    targetId: email,
    priorValue: { banned: true },
    newValue: { banned: false },
  });
}

export async function unverifyRecruiter(email: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("recruiter_identities").update({ verified_at: null }).eq("email", email);
  if (error) {
    throw new Error(`Failed to unverify recruiter: ${error.message}`);
  }
  await logAdminAction({
    adminEmail,
    action: "recruiter.unverify",
    targetType: "recruiter",
    targetId: email,
    priorValue: { verified: true },
    newValue: { verified: false },
  });
}

export async function updateRecruiterCompany(email: string, companyName: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: existing } = await supabase.from("recruiter_identities").select("company_name").eq("email", email).maybeSingle();

  const { error } = await supabase.from("recruiter_identities").update({ company_name: companyName }).eq("email", email);
  if (error) {
    throw new Error(`Failed to update recruiter company: ${error.message}`);
  }

  await logAdminAction({
    adminEmail,
    action: "recruiter.update_company",
    targetType: "recruiter",
    targetId: email,
    priorValue: { companyName: existing?.company_name ?? null },
    newValue: { companyName },
  });
}

export async function listRecruiters(): Promise<RecruiterRow[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("recruiter_identities")
    .select("email, company_name, verified_at, banned_at")
    .order("email", { ascending: true });

  return (data ?? []).map((r) => ({
    email: r.email,
    companyName: r.company_name,
    verifiedAt: r.verified_at,
    bannedAt: r.banned_at,
  }));
}

export async function getRecruiter(email: string): Promise<RecruiterRow | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("recruiter_identities").select("email, company_name, verified_at, banned_at").eq("email", email).maybeSingle();

  if (!data) return null;
  return { email: data.email, companyName: data.company_name, verifiedAt: data.verified_at, bannedAt: data.banned_at };
}
