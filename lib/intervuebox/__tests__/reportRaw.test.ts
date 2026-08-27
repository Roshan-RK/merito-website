import { describe, it, expect } from "vitest";
import type { InterviewReportReady } from "../interviewReports";
import { buildReportRaw } from "../reportRaw";

// A READY report carrying more fields than the persisted shape keeps today
// (opportunities/threats/whatToFocusOnNext/... live on InterviewReportReady
// but were never written to report_raw). buildReportRaw must pass exactly the
// historical field list straight through and drop the rest.
const REPORT: InterviewReportReady = {
  overallScore: 73,
  skillMetrics: { communication: 8 },
  overallSummary: "Solid.",
  strengths: "Clear structure.",
  areasOfImprovement: "Depth.",
  shareableReportLink: "https://x/y",
  approxDurationMinutes: 21,
  flagForSuspiciousActivity: false,
  integrityCheck: "clear",
  videoReport: null,
  feedbackToInterviewer: "Hire.",
  roadmap: "Do X.",
  opportunities: "SHOULD BE DROPPED",
  threats: "SHOULD BE DROPPED",
  criteriaEvaluationTable: [{ criteria: "c1", status: "Matched", reason: "r" }],
  interviewTitle: "PM screen",
  skillReport: { communication: { score: 8, comment: "good" } },
  overallSkillScore: 8,
  answers: [{ question: "q", transcript: "t", timestamp: "00:01:00", metrics: { dynamicSkills: [] } }],
  knowledgeAnswers: [],
  whatToFocusOnNext: "SHOULD BE DROPPED",
  trainingFocus: "SHOULD BE DROPPED",
  confidenceLevel: null,
  presentation: null,
  bodyLanguage: null,
  environmentCheck: null,
  responseQuality: null,
  tabChanges: 2,
};

describe("buildReportRaw", () => {
  it("keeps exactly the historical report_raw field list and passes values through", () => {
    const raw = buildReportRaw(REPORT);
    expect(Object.keys(raw)).toEqual([
      "overallScore",
      "skillMetrics",
      "overallSummary",
      "strengths",
      "areasOfImprovement",
      "shareableReportLink",
      "approxDurationMinutes",
      "flagForSuspiciousActivity",
      "integrityCheck",
      "videoReport",
      "feedbackToInterviewer",
      "roadmap",
      "criteriaEvaluationTable",
      "interviewTitle",
      "skillReport",
      "overallSkillScore",
      "answers",
      "knowledgeAnswers",
    ]);
    expect(raw.overallScore).toBe(REPORT.overallScore);
    expect(raw.skillReport).toBe(REPORT.skillReport);
    expect(raw.answers).toBe(REPORT.answers);
    expect(raw.criteriaEvaluationTable).toBe(REPORT.criteriaEvaluationTable);
    // Fields the persisted shape never carried stay dropped.
    expect(raw).not.toHaveProperty("opportunities");
    expect(raw).not.toHaveProperty("threats");
    expect(raw).not.toHaveProperty("whatToFocusOnNext");
    expect(raw).not.toHaveProperty("tabChanges");
  });
});
