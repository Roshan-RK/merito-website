import { getSupabaseServerClient } from "@/lib/supabase";
import { getReferenceCheckStatus, computeReferenceReport, type ReferenceReport, type RefereeRow } from "@/lib/referenceChecks";
import { getCandidateResumeDetails, type CandidateResumeDetails, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import type { Scores, Validity } from "@/lib/personality";

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

export async function listCandidates(): Promise<CandidateListRow[]> {
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

export type CandidateLeadDetail = {
  id: string;
  roleTitle: string;
  createdAt: string;
  fitmentReport: ResumeMatchReportReady | null;
  candidateDetails: CandidateResumeDetails | null;
  interviewReport: InterviewReportReady | null;
};

export type CandidateDetail = {
  userId: string;
  email: string;
  name: string | null;
  leads: CandidateLeadDetail[];
  personality: { roleTitle: string; scores: Scores; validity: Validity } | null;
  references: { status: string; minReferences: number; report: ReferenceReport; referees: RefereeRow[] } | null;
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
    .select("role_title, status, report_raw")
    .eq("user_id", userId)
    .eq("status", "ready");

  const interviewByRole = new Map((interviewRows ?? []).map((r) => [r.role_title, r.report_raw as InterviewReportReady]));

  const { data: personalityRow } = await supabase
    .from("personality_tests")
    .select("role_title, scores, validity")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const referenceStatus = await getReferenceCheckStatus(userId);

  const leads: CandidateLeadDetail[] = await Promise.all(
    leadRows.map(async (lead) => {
      const candidateDetails = lead.ib_applied_job_id
        ? await getCandidateResumeDetails(lead.ib_applied_job_id).catch(() => null)
        : null;
      return {
        id: lead.id,
        roleTitle: lead.role_title,
        createdAt: lead.created_at,
        fitmentReport: lead.resume_match_status === "READY" ? (lead.resume_match_raw as ResumeMatchReportReady) : null,
        candidateDetails,
        interviewReport: interviewByRole.get(lead.role_title) ?? null,
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
  };
}
