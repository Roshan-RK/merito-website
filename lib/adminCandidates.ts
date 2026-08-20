import { getSupabaseServerClient } from "@/lib/supabase";
import { getReferenceCheckStatus, computeReferenceReport, type ReferenceReport, type RefereeRow } from "@/lib/referenceChecks";
import { getCandidateResumeDetails, getResumeMatchReport, scoreOutOfTen, type CandidateResumeDetails, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import type { Scores, Validity } from "@/lib/personality";
import { logAdminAction, listActionsForTarget, type AdminActionRow } from "@/lib/adminAuditLog";
import type { ReportType } from "@/app/hub/account/reportSections";
import type { HubNotificationCategory } from "@/lib/hubNotifications";
import { getAbsoluteUrl } from "@/lib/site";

const BAN_DURATION_INDEFINITE = "876000h"; // ~100 years, matches Supabase's ban_duration API shape for "indefinite"
const DELETION_PURGE_WINDOW_DAYS = 30;

export type FunnelStage = "fitment_started" | "report_unlocked" | "interview_ready" | "personality_completed" | "reference_completed";

export const FUNNEL_STAGE_LABEL: Record<FunnelStage, string> = {
  fitment_started: "Fitment check started",
  report_unlocked: "Report unlocked",
  interview_ready: "Interview completed",
  personality_completed: "Personality test completed",
  reference_completed: "References completed",
};

type FunnelSets = {
  reportUnlocked: Set<string>;
  interviewReady: Set<string>;
  personalityCompleted: Set<string>;
  referenceCompleted: Set<string>;
};

export function computeFunnelStage(userId: string, sets: FunnelSets): FunnelStage {
  let stage: FunnelStage = "fitment_started";
  if (sets.reportUnlocked.has(userId)) stage = "report_unlocked";
  if (sets.interviewReady.has(userId)) stage = "interview_ready";
  if (sets.personalityCompleted.has(userId)) stage = "personality_completed";
  if (sets.referenceCompleted.has(userId)) stage = "reference_completed";
  return stage;
}

export type CandidateListRow = {
  userId: string;
  email: string;
  name: string | null;
  latestRoleTitle: string;
  firstSeenAt: string;
  funnelStage: FunnelStage;
};

const PAGE_SIZE = 20;

export type PaginatedCandidates = { rows: CandidateListRow[]; total: number; totalPages: number; page: number };

async function fetchAllCandidates(): Promise<CandidateListRow[]> {
  const supabase = getSupabaseServerClient();

  const [{ data: leadRows }, { data: unlockRows }, { data: interviewRows }, { data: personalityRows }, { data: referenceRows }] = await Promise.all([
    supabase.from("fitment_leads").select("user_id, email, name, role_title, created_at").order("created_at", { ascending: true }),
    supabase.from("report_unlocks").select("user_id"),
    supabase.from("fitment_interviews").select("user_id").eq("status", "ready"),
    supabase.from("personality_tests").select("user_id"),
    supabase.from("reference_checks").select("user_id").eq("status", "completed"),
  ]);

  const sets: FunnelSets = {
    reportUnlocked: new Set((unlockRows ?? []).map((r) => r.user_id)),
    interviewReady: new Set((interviewRows ?? []).map((r) => r.user_id)),
    personalityCompleted: new Set((personalityRows ?? []).map((r) => r.user_id)),
    referenceCompleted: new Set((referenceRows ?? []).map((r) => r.user_id)),
  };

  const byUser = new Map<string, CandidateListRow>();
  for (const row of leadRows ?? []) {
    const existing = byUser.get(row.user_id);
    if (!existing) {
      byUser.set(row.user_id, {
        userId: row.user_id,
        email: row.email,
        name: row.name,
        latestRoleTitle: row.role_title,
        firstSeenAt: row.created_at,
        funnelStage: "fitment_started",
      });
    } else {
      existing.latestRoleTitle = row.role_title;
      existing.name = row.name ?? existing.name;
    }
  }

  return Array.from(byUser.values())
    .map((c) => ({ ...c, funnelStage: computeFunnelStage(c.userId, sets) }))
    .sort((a, b) => (a.firstSeenAt < b.firstSeenAt ? 1 : -1));
}

export async function listCandidates(page: number = 1): Promise<PaginatedCandidates> {
  const all = await fetchAllCandidates();
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * PAGE_SIZE;

  return { rows: all.slice(start, start + PAGE_SIZE), total, totalPages, page: clampedPage };
}

export type CandidateLeadDetail = {
  id: string;
  roleTitle: string;
  createdAt: string;
  fitmentReport: ResumeMatchReportReady | null;
  candidateDetails: CandidateResumeDetails | null;
  interviewReport: InterviewReportReady | null;
  // Present whenever an interview was invited for this role, ready or not --
  // lets the admin UI offer a manual generate/reinvite action on a stuck
  // (e.g. terminated) interview even though interviewReport is still null.
  interviewRow: { id: string; status: string; ibAgentId: string; ibCandidateId: string } | null;
};

export type ShareLinkDetail = {
  roleTitle: string;
  token: string;
  revoked: boolean;
  expired: boolean;
  expiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
};

export type CandidateDetail = {
  userId: string;
  email: string;
  name: string | null;
  leads: CandidateLeadDetail[];
  personality: { roleTitle: string; scores: Scores; validity: Validity } | null;
  references: { status: string; minReferences: number; report: ReferenceReport; referees: RefereeRow[] } | null;
  recruiterPreview: {
    settings: { enabled: boolean; sections: string[]; linkedinUrl: string | null; updatedAt: string } | null;
    shareLinks: ShareLinkDetail[];
    overrideHistory: AdminActionRow[];
  };
  pendingDeletion: { purgeAfter: string } | null;
};

export async function getCandidateDetail(userId: string): Promise<CandidateDetail | null> {
  const supabase = getSupabaseServerClient();

  const { data: leadRows } = await supabase
    .from("fitment_leads")
    .select("id, role_title, score, name, email, resume_match_status, resume_match_raw, ib_applied_job_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!leadRows || leadRows.length === 0) return null;

  const { data: interviewRows } = await supabase
    .from("fitment_interviews")
    .select("id, role_title, status, report_raw, ib_agent_id, ib_candidate_id, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  // Most-recent row per role -- mirrors the ordering used everywhere else
  // fitment_interviews is read by role_title (see interview/status/route.ts).
  const latestInterviewByRole = new Map<string, NonNullable<typeof interviewRows>[number]>();
  for (const row of interviewRows ?? []) {
    if (!latestInterviewByRole.has(row.role_title)) latestInterviewByRole.set(row.role_title, row);
  }
  const interviewByRole = new Map(
    [...latestInterviewByRole.entries()]
      .filter(([, row]) => row.status === "ready")
      .map(([roleTitle, row]) => [roleTitle, row.report_raw as InterviewReportReady])
  );

  const { data: personalityRow } = await supabase
    .from("personality_tests")
    .select("role_title, scores, validity")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const referenceStatus = await getReferenceCheckStatus(userId);

  const { data: previewSettingsRow } = await supabase
    .from("recruiter_preview_settings")
    .select("enabled, sections, linkedin_url, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: shareLinkRows } = await supabase
    .from("report_share_links")
    .select("role_title, token, revoked_at, expires_at, view_count, last_viewed_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const { data: deletionRow } = await supabase
    .from("candidate_deletions")
    .select("purge_after")
    .eq("user_id", userId)
    .is("purged_at", null)
    .maybeSingle();

  const candidateActions = await listActionsForTarget("candidate", userId);
  const recruiterPreviewOverrideHistory = candidateActions.filter((a) => a.action === "candidate.recruiter_preview_override");

  const leads: CandidateLeadDetail[] = await Promise.all(
    leadRows.map(async (lead) => {
      const candidateDetails = lead.ib_applied_job_id
        ? await getCandidateResumeDetails(lead.ib_applied_job_id).catch(() => null)
        : null;
      const interviewRow = latestInterviewByRole.get(lead.role_title);
      return {
        id: lead.id,
        roleTitle: lead.role_title,
        createdAt: lead.created_at,
        fitmentReport: lead.resume_match_status === "READY" ? (lead.resume_match_raw as ResumeMatchReportReady) : null,
        candidateDetails,
        interviewReport: interviewByRole.get(lead.role_title) ?? null,
        interviewRow: interviewRow
          ? { id: interviewRow.id, status: interviewRow.status, ibAgentId: interviewRow.ib_agent_id, ibCandidateId: interviewRow.ib_candidate_id }
          : null,
      };
    })
  );

  return {
    userId,
    email: leadRows[0].email,
    name: leadRows[0].name,
    leads,
    personality:
      personalityRow && personalityRow.scores && personalityRow.validity
        ? { roleTitle: personalityRow.role_title, scores: personalityRow.scores as Scores, validity: personalityRow.validity as Validity }
        : null,
    references: referenceStatus
      ? {
          status: referenceStatus.status,
          minReferences: referenceStatus.minReferences,
          report: computeReferenceReport(referenceStatus.referees),
          referees: referenceStatus.referees,
        }
      : null,
    recruiterPreview: {
      settings: previewSettingsRow
        ? {
            enabled: previewSettingsRow.enabled,
            sections: previewSettingsRow.sections,
            linkedinUrl: previewSettingsRow.linkedin_url,
            updatedAt: previewSettingsRow.updated_at,
          }
        : null,
      shareLinks: (shareLinkRows ?? []).map((r) => ({
        roleTitle: r.role_title,
        token: r.token,
        revoked: Boolean(r.revoked_at),
        expired: Boolean(r.expires_at) && new Date(r.expires_at) < new Date(),
        expiresAt: r.expires_at,
        viewCount: r.view_count,
        lastViewedAt: r.last_viewed_at,
        createdAt: r.created_at,
      })),
      overrideHistory: recruiterPreviewOverrideHistory,
    },
    pendingDeletion: deletionRow ? { purgeAfter: deletionRow.purge_after } : null,
  };
}

export async function banCandidate(userId: string, adminEmail: string, reason: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION_INDEFINITE });
  if (error) {
    throw new Error(`Failed to ban candidate: ${error.message}`);
  }
  await logAdminAction({
    adminEmail,
    action: "candidate.ban",
    targetType: "candidate",
    targetId: userId,
    priorValue: null,
    newValue: { banned: true, reason },
  });
}

export async function unbanCandidate(userId: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) {
    throw new Error(`Failed to unban candidate: ${error.message}`);
  }
  await logAdminAction({
    adminEmail,
    action: "candidate.unban",
    targetType: "candidate",
    targetId: userId,
    priorValue: { banned: true },
    newValue: { banned: false },
  });
}

// Soft-delete: bans login (reversible via restoreCandidate) and records deletion
// intent with a purge_after date. Does not touch fitment_leads/interviews/
// personality_tests/reference_checks/report_share_links -- those are left in
// place for the retention window. Actual cross-table erasure is a deliberate
// fast-follow, not built here: it touches ~9 FK-linked tables and needs its
// own careful design (see plans/2026-08-20-admin-v3-capability-roadmap.md).
export async function deleteCandidate(userId: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: leadRows } = await supabase
    .from("fitment_leads")
    .select("id, role_title, email")
    .eq("user_id", userId);

  const { error: banError } = await supabase.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION_INDEFINITE });
  if (banError) {
    throw new Error(`Failed to delete candidate: ${banError.message}`);
  }

  const purgeAfter = new Date(Date.now() + DELETION_PURGE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await supabase.from("candidate_deletions").insert({
    user_id: userId,
    requested_by: adminEmail,
    purge_after: purgeAfter,
  });
  if (insertError) {
    throw new Error(`Failed to delete candidate: ${insertError.message}`);
  }

  await logAdminAction({
    adminEmail,
    action: "candidate.soft_delete",
    targetType: "candidate",
    targetId: userId,
    priorValue: { leads: leadRows ?? [] },
    newValue: { pendingDeletion: true, purgeAfter },
  });
}

export async function restoreCandidate(userId: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error: unbanError } = await supabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (unbanError) {
    throw new Error(`Failed to restore candidate: ${unbanError.message}`);
  }

  const { error: deleteError } = await supabase.from("candidate_deletions").delete().eq("user_id", userId);
  if (deleteError) {
    throw new Error(`Failed to restore candidate: ${deleteError.message}`);
  }

  await logAdminAction({
    adminEmail,
    action: "candidate.restore",
    targetType: "candidate",
    targetId: userId,
    priorValue: { pendingDeletion: true },
    newValue: { pendingDeletion: false },
  });
}

export async function generateCandidateMagicLink(email: string, adminEmail: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data) {
    throw new Error(`Failed to generate magic link: ${error?.message ?? "unknown error"}`);
  }

  await logAdminAction({
    adminEmail,
    action: "candidate.magic_link_generated",
    targetType: "candidate",
    targetId: email,
    priorValue: null,
    newValue: { linkGenerated: true },
  });

  // data.properties.action_link points at Supabase's own /auth/v1/verify
  // endpoint, which redirects to the raw site URL and never runs our
  // /hub/auth/callback route — so no app session cookie gets set. Route
  // through our own callback instead, which is what actually logs the
  // candidate in.
  const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "magiclink" });
  return getAbsoluteUrl(`/hub/auth/callback?${params.toString()}`);
}

export async function mergeCandidateAccounts(keepUserId: string, mergeUserId: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: rowsMoved, error: rpcError } = await supabase.rpc("merge_candidate_accounts", {
    keep_user_id: keepUserId,
    merge_user_id: mergeUserId,
  });
  if (rpcError || !rowsMoved) {
    throw new Error(`Failed to merge accounts: ${rpcError?.message ?? "unknown error"}`);
  }

  const { error: banError } = await supabase.auth.admin.updateUserById(mergeUserId, { ban_duration: BAN_DURATION_INDEFINITE });
  if (banError) {
    throw new Error(`Merged accounts but failed to ban the merged-away account: ${banError.message}`);
  }

  await logAdminAction({
    adminEmail,
    action: "candidate.merge",
    targetType: "candidate",
    targetId: keepUserId,
    priorValue: { mergedFrom: mergeUserId },
    newValue: { rowsMoved },
  });
}

export async function retryResumeMatch(leadId: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("user_id, ib_applied_job_id, resume_match_status")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead || !lead.ib_applied_job_id) {
    throw new Error("Lead not found or has no linked IntervueBox application.");
  }

  const report = await getResumeMatchReport(lead.ib_applied_job_id);
  if (report.status !== "READY") {
    throw new Error("IntervueBox still hasn't produced a result for this candidate.");
  }

  const { error } = await supabase
    .from("fitment_leads")
    .update({
      resume_match_status: report.status,
      resume_match_score: report.overallScore,
      resume_match_raw: {
        overallScore: report.overallScore,
        rank: report.rank,
        categories: report.categories,
        summary: report.summary,
        strongPoints: report.strongPoints,
        weakPoints: report.weakPoints,
      },
      score: scoreOutOfTen(report.overallScore),
      verdict: report.summary || "No summary available.",
    })
    .eq("id", leadId);
  if (error) {
    throw new Error(`Failed to update lead with retried resume match: ${error.message}`);
  }

  await logAdminAction({
    adminEmail,
    action: "candidate.retry_resume_match",
    targetType: "candidate",
    targetId: lead.user_id ?? leadId,
    priorValue: { status: "PENDING" },
    newValue: { status: report.status },
  });
}

export async function sendCandidateNotification(
  userId: string,
  message: string,
  adminEmail: string,
  category: HubNotificationCategory = "general"
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("hub_notifications").insert({
    user_id: userId,
    message,
    category,
    created_by: adminEmail,
  });
  if (error) {
    throw new Error(`Failed to send notification: ${error.message}`);
  }

  await logAdminAction({
    adminEmail,
    action: "candidate.notify",
    targetType: "candidate",
    targetId: userId,
    priorValue: null,
    newValue: { message, category },
  });
}

const VALID_REPORT_SECTIONS: ReportType[] = ["fitment", "personality", "interview", "references"];

export async function updateRecruiterPreviewOverride(
  userId: string,
  updates: { enabled: boolean; sections: ReportType[] },
  adminEmail: string,
  reason: string
): Promise<void> {
  if (!updates.sections.every((s) => VALID_REPORT_SECTIONS.includes(s))) {
    throw new Error("sections must only contain fitment, personality, interview, or references.");
  }

  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("recruiter_preview_settings")
    .select("enabled, sections, linkedin_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (updates.enabled && !existing?.linkedin_url) {
    throw new Error("Candidate hasn't set a LinkedIn profile URL yet — visibility can't be turned on until they do.");
  }

  const priorValue = { enabled: existing?.enabled ?? false, sections: existing?.sections ?? [] };

  const { error } = await supabase.from("recruiter_preview_settings").upsert(
    {
      user_id: userId,
      enabled: updates.enabled,
      sections: updates.sections,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    throw new Error(`Failed to update recruiter preview settings: ${error.message}`);
  }

  await logAdminAction({
    adminEmail,
    action: "candidate.recruiter_preview_override",
    targetType: "candidate",
    targetId: userId,
    priorValue,
    newValue: { enabled: updates.enabled, sections: updates.sections, reason },
  });
}
