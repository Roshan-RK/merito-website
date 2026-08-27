import type { InterviewReportReady } from "./interviewReports";

// The exact object that sweepPendingInterviews() (and, before B1, the status
// route's self-heal) has written into fitment_interviews.report_raw since the
// integration shipped. Extracted to one place so the sweep, reconcileInterviewRow(),
// and the status route all persist a byte-identical shape.
//
// Field list AND order are load-bearing for the report UI -- do NOT add or
// reorder without checking every read site. InterviewReportReady now also
// carries opportunities/threats/whatToFocusOnNext/trainingFocus/tabChanges/
// confidenceLevel/... -- those were never persisted here and stay dropped;
// widening the stored shape is a separate change.
export function buildReportRaw(report: InterviewReportReady): Record<string, unknown> {
  return {
    overallScore: report.overallScore,
    skillMetrics: report.skillMetrics,
    overallSummary: report.overallSummary,
    strengths: report.strengths,
    areasOfImprovement: report.areasOfImprovement,
    shareableReportLink: report.shareableReportLink,
    approxDurationMinutes: report.approxDurationMinutes,
    flagForSuspiciousActivity: report.flagForSuspiciousActivity,
    integrityCheck: report.integrityCheck,
    videoReport: report.videoReport,
    feedbackToInterviewer: report.feedbackToInterviewer,
    roadmap: report.roadmap,
    criteriaEvaluationTable: report.criteriaEvaluationTable,
    interviewTitle: report.interviewTitle,
    skillReport: report.skillReport,
    overallSkillScore: report.overallSkillScore,
    answers: report.answers,
    knowledgeAnswers: report.knowledgeAnswers,
  };
}
