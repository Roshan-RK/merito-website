import type { SupabaseClient } from "@supabase/supabase-js";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getReferenceCheckStatus, computeReferenceReport } from "@/lib/referenceChecks";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import { nameFromEmail, type Scores } from "@/lib/personality";

export type CombinedReportData = {
  fitment: { roleTitle: string; displayName: string; report: ResumeMatchReportReady } | null;
  personality: { scores: Scores } | null;
  interview: { roleTitle: string; report: InterviewReportReady; updatedAt: string } | null;
  references: ReturnType<typeof computeReferenceReport> | null;
  displayName: string;
  primaryRole: string;
};

// Works with either a session-scoped client (the authed combined-report
// page) or the service-role client (the public share page, which has no
// session to scope from) — every query here is already filtered by the
// explicit userId param, not by RLS, so either client returns the same
// rows for a given userId.
export async function loadCombinedReportData({
  supabase,
  userId,
  userEmail,
  include,
  roleTitleParam,
}: {
  supabase: SupabaseClient;
  userId: string;
  userEmail: string | null | undefined;
  include: Set<string>;
  roleTitleParam: string | null;
}): Promise<CombinedReportData> {
  // Fetched unconditionally (not gated by include.has("fitment")) because
  // fitment_leads.name is the only real-name source the public share page
  // has -- that page deliberately never passes a real userEmail (privacy:
  // no PII exposed to anonymous visitors), so when the fitment section
  // itself is excluded or still locked, this lookup is the only thing
  // standing between the displayed name and the generic email-less
  // nameFromEmail("") fallback ("You").
  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, role_title, name, resume_match_status, resume_match_raw")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const currentLead = leads?.[0];

  let fitment: CombinedReportData["fitment"] = null;
  if (include.has("fitment") && currentLead) {
    const unlocked = await isReportUnlocked(userId, currentLead.role_title);
    if (unlocked && currentLead.resume_match_status === "READY" && currentLead.resume_match_raw) {
      fitment = {
        roleTitle: currentLead.role_title,
        displayName: currentLead.name || nameFromEmail(userEmail ?? ""),
        report: currentLead.resume_match_raw as ResumeMatchReportReady,
      };
    }
  }

  const roleTitle = roleTitleParam ?? fitment?.roleTitle ?? currentLead?.role_title ?? null;

  let personality: CombinedReportData["personality"] = null;
  if (include.has("personality")) {
    const { data: existing } = await supabase
      .from("personality_tests")
      .select("scores, validity")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.scores && existing?.validity) {
      personality = { scores: existing.scores as Scores };
    }
  }

  let interview: CombinedReportData["interview"] = null;
  if (include.has("interview")) {
    let query = supabase.from("fitment_interviews").select("role_title, status, report_raw, updated_at").eq("user_id", userId);
    if (roleTitle) query = query.eq("role_title", roleTitle);
    const { data: row } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (row && row.status === "ready" && row.report_raw) {
      interview = { roleTitle: row.role_title, report: row.report_raw as InterviewReportReady, updatedAt: row.updated_at };
    }
  }

  let references: CombinedReportData["references"] = null;
  if (include.has("references")) {
    const status = await getReferenceCheckStatus(userId);
    if (status?.status === "completed") {
      references = computeReferenceReport(status.referees);
    }
  }

  const displayName = fitment?.displayName || currentLead?.name || nameFromEmail(userEmail ?? "");
  const primaryRole = fitment?.roleTitle || interview?.roleTitle || roleTitle || "-";

  return { fitment, personality, interview, references, displayName, primaryRole };
}
