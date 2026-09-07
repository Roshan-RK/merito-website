import { IntervueBoxError, intervueBoxFetch } from "./client";
import type { CriteriaMatchStatus } from "../criteriaStatus";

// Real shape confirmed 2026-07-28 against a live isCriteriaMatch:true report.
// status has exactly 3 confirmed real values (see CriteriaMatchStatus) —
// confirmed against a real completed interview (Marketing Exec, IV-C4QJXmR).
export type CriteriaEvaluationEntry = {
  criteria: string;
  status: CriteriaMatchStatus;
  reason: string;
};

export type SkillReportEntry = { score: number; comment: string };

export type AnswerDetail = {
  question: string;
  transcript: string;
  timestamp: string;
  metrics: {
    score?: number;
    evaluation?: string;
    dynamicSkills: Array<{ skill: string; comment: string }>;
  };
};

export type InterviewReportReady = {
  overallScore: number; // 0-10, per sessionDetails.overallReport.score
  skillMetrics: Record<string, number>; // 0-10 each, per sessionDetails.overallReport.metrics
  overallSummary: string;
  strengths: string | null;
  areasOfImprovement: string | null;
  shareableReportLink: string | null;
  approxDurationMinutes: number | null;
  // Live-confirmed against two real interviews (2026-07-27): proctoring/
  // integrity data lives on sessionDetails, not overallReport.
  flagForSuspiciousActivity: boolean;
  integrityCheck: string | null;
  videoReport: string | null;
  // Blunt hire/no-hire read + SWOT. Originally excluded from the candidate's
  // own /hub/account/interview view (recruiter-only), but IntervueBox's own
  // candidate-facing PDF export shows it plainly — shown on both surfaces
  // as of 2026-07-28.
  feedbackToInterviewer: string | null;
  roadmap: string | null;
  // Same freeform-bullet shape as strengths/areasOfImprovement above --
  // opportunities/threats complete the SWOT the mockup's Coaching plan tab
  // shows. Not present on any real IntervueBox response seen to date; same
  // forward-compatible treatment as whatToFocusOnNext/trainingFocus below.
  opportunities: string | null;
  threats: string | null;
  criteriaEvaluationTable: CriteriaEvaluationEntry[];
  interviewTitle: string | null;
  skillReport: Record<string, SkillReportEntry>;
  overallSkillScore: number | null;
  answers: AnswerDetail[];
  knowledgeAnswers: unknown[];
  // Not present on any real IntervueBox response seen to date (see
  // RawInterviewReportResponse below) -- kept as forward-compatible optional
  // fields so the Coaching plan / Practice conduct UI can show these sections
  // the moment real data exists, without another round of plumbing. Always
  // null today; never fabricate a value for these client-side.
  whatToFocusOnNext: string | null;
  trainingFocus: string | null;
  confidenceLevel: string | null;
  presentation: string | null;
  bodyLanguage: string | null;
  environmentCheck: string | null;
  responseQuality: string | null;
  // Proctoring stat the mockup's Practice conduct tab shows as a count --
  // same "not seen live yet, defensive mapping" treatment as the conduct
  // fields above; lives with flagForSuspiciousActivity/integrityCheck on
  // sessionDetails, not overallReport, since it's proctoring data.
  tabChanges: number | null;
};

export type InterviewReport = { status: "NOT_READY" } | ({ status: "READY" } & InterviewReportReady);

// Live-confirmed against the real API (2026-07-23): the documented
// `sessionDetails.overallSkillScore` / `sessionDetails.overallReport` (string)
// / `sessionDetails.skillReport` shape doesn't match what the API actually
// returns. The real overall score, per-skill metrics, and narrative summary
// all live nested under `sessionDetails.overallReport` (an object), and
// `sessionDetails.skillReport` is empty. `feedbackToInterviewer` and `rank`
// also exist on the real payload but are recruiter-facing (contain a blunt
// pass/fail recommendation) — deliberately not surfaced to the candidate.
type RawInterviewReportResponse = {
  shareableReportLink: string | null;
  sessionDetails: {
    // The timestamp on each entry is also used as a proxy for total elapsed
    // duration (last answer's timestamp) — not a true recording-length field
    // (IntervueBox doesn't expose one). Never presented as exact.
    answers?: Array<{
      question: string;
      transcript: string;
      timestamp: string;
      metrics?: {
        score?: number;
        evaluation?: string;
        dynamicSkills?: Array<{ skill: string; comment: string }>;
      };
    }>;
    flagForSuspiciousActivity?: boolean;
    integrityCheck?: string;
    videoReport?: string;
    tabChanges?: number;
    interviewTitle?: string;
    skillReport?: Record<string, { score: number; comment: string }>;
    overallSkillScore?: number;
    knowledgeAnswers?: unknown[];
    // Discrete camera/delivery fields the mockup's Practice conduct tab
    // shows -- not seen on any real response yet, mapped defensively in case
    // IntervueBox adds them later (see InterviewReportReady's comment).
    confidenceLevel?: string;
    presentation?: string;
    bodyLanguage?: string;
    environmentCheck?: string;
    responseQuality?: string;
    overallReport: {
      score: number;
      metrics: Record<string, number>;
      overallSummary: string;
      strengths?: string;
      areasOfImprovement?: string;
      opportunities?: string;
      threats?: string;
      feedbackToInterviewer?: string;
      roadmap?: string;
      criteriaEvaluationTable?: CriteriaEvaluationEntry[];
      // Same forward-compatible treatment as the conduct fields above.
      whatToFocusOnNext?: string;
      trainingFocus?: string;
    };
  };
};

function parseTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function computeApproxDurationMinutes(answers: Array<{ timestamp: string }> | undefined): number | null {
  if (!answers || answers.length === 0) return null;
  const lastTimestamp = answers[answers.length - 1].timestamp;
  const minutes = Math.ceil(parseTimestampToSeconds(lastTimestamp) / 60);
  return Number.isFinite(minutes) ? minutes : null;
}

type CandidatesForInterviewResponse = {
  total: number;
  candidates: Array<{ candidateId: string; interviewStatus: string }>;
};

// IntervueBox's outcome status for a candidate on an interview -- live-
// confirmed values include "INVITED" (not started) and "TERMINATED" (ended
// without reaching an evaluated outcome). Report generation is only
// automatic for outcomes reached normally; TERMINATED needs an explicit
// generateInterviewReport call (see below). Returns null if the candidate
// has no session on this interview at all yet.
export async function getInterviewCandidateStatus(interviewId: string, candidateId: string): Promise<string | null> {
  const response = await intervueBoxFetch<CandidatesForInterviewResponse>(
    `/public/interviews/${interviewId}/candidates`
  );
  return response.candidates.find((c) => c.candidateId === candidateId)?.interviewStatus ?? null;
}

// Vendor-confirmed (Krupal, 2026-08-10): a terminated interview's report is
// never auto-generated -- IntervueBox only evaluates outcomes reached
// normally (evaluated/shortlisted/hold/rejected/qualified). This kicks off
// generation for one or more candidates on an interview explicitly; the
// resulting report still has to be picked up afterward via the existing
// getInterviewReport poll/webhook, same as a normal completion.
export async function generateInterviewReport(interviewId: string, candidateIds: string[]): Promise<void> {
  await intervueBoxFetch<unknown>("/public/reports/interviews/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interviewId, candidateIds }),
  });
}

export async function getInterviewReport(interviewId: string, candidateId: string): Promise<InterviewReport> {
  try {
    // Was GET-with-body until 2026-09-07, when IntervueBox moved this to a
    // plain POST (the GET route now 404s with "Cannot GET ..."). Same request
    // body and same response shape as before. A bare 404 catch used to mask
    // that route change as "report not ready", stranding every completed
    // interview -- the isRoutingError guard below makes a future move fail loud.
    const response = await intervueBoxFetch<RawInterviewReportResponse>("/public/reports/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId, candidateId }),
    });
    const overallReport = response.sessionDetails.overallReport;
    return {
      status: "READY",
      // Live-confirmed 2026-07-28 against two real reports (one per
      // isCriteriaMatch mode): overallReport.score is 0-100 (39, 100 seen),
      // not the 0-10 this file's type comment previously claimed. Passed
      // through as-is (0-100) — display sites (InterviewScoreGauge,
      // ParameterScoreTile, combined-report's percent tile) are the ones
      // that now assume 0-100, not this mapping.
      overallScore: overallReport.score,
      // NOT on the same confirmed scale: under isCriteriaMatch:true, metrics
      // is a single { criteriaMatch: 100 } aggregate, not skill-based mode's
      // per-skill breakdown — ParameterScoreTile's "skill grid" doesn't
      // semantically fit either shape well for that mode. Needs its own
      // product decision (see memory intervuebox-interview-modes).
      skillMetrics: overallReport.metrics,
      overallSummary: overallReport.overallSummary,
      strengths: overallReport.strengths ?? null,
      areasOfImprovement: overallReport.areasOfImprovement ?? null,
      shareableReportLink: response.shareableReportLink,
      approxDurationMinutes: computeApproxDurationMinutes(response.sessionDetails.answers),
      flagForSuspiciousActivity: response.sessionDetails.flagForSuspiciousActivity ?? false,
      integrityCheck: response.sessionDetails.integrityCheck ?? null,
      videoReport: response.sessionDetails.videoReport ?? null,
      feedbackToInterviewer: overallReport.feedbackToInterviewer ?? null,
      roadmap: overallReport.roadmap ?? null,
      opportunities: overallReport.opportunities ?? null,
      threats: overallReport.threats ?? null,
      criteriaEvaluationTable: overallReport.criteriaEvaluationTable ?? [],
      interviewTitle: response.sessionDetails.interviewTitle ?? null,
      skillReport: response.sessionDetails.skillReport ?? {},
      overallSkillScore: response.sessionDetails.overallSkillScore ?? null,
      knowledgeAnswers: response.sessionDetails.knowledgeAnswers ?? [],
      whatToFocusOnNext: overallReport.whatToFocusOnNext ?? null,
      trainingFocus: overallReport.trainingFocus ?? null,
      confidenceLevel: response.sessionDetails.confidenceLevel ?? null,
      presentation: response.sessionDetails.presentation ?? null,
      bodyLanguage: response.sessionDetails.bodyLanguage ?? null,
      environmentCheck: response.sessionDetails.environmentCheck ?? null,
      responseQuality: response.sessionDetails.responseQuality ?? null,
      tabChanges: response.sessionDetails.tabChanges ?? null,
      answers: (response.sessionDetails.answers ?? []).map((a) => ({
        question: a.question,
        transcript: a.transcript,
        timestamp: a.timestamp,
        metrics: {
          score: a.metrics?.score,
          evaluation: a.metrics?.evaluation,
          dynamicSkills: a.metrics?.dynamicSkills ?? [],
        },
      })),
    };
  } catch (err) {
    if (err instanceof IntervueBoxError && err.status === 404) {
      // A genuine "report not generated yet" 404 -- expected, poll again later.
      // But an Express/Nest routing 404 ("Cannot GET/POST /api/v1/...") means
      // the endpoint itself moved: never treat that as "not ready" (that's the
      // 2026-09-07 incident), surface it so the pickup pipeline visibly breaks.
      const isRoutingError = /^Cannot (GET|POST|PUT|PATCH|DELETE) /.test(err.message);
      if (!isRoutingError) {
        return { status: "NOT_READY" };
      }
    }
    throw err;
  }
}
