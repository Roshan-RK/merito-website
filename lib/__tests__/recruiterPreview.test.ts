import { describe, it, expect } from "vitest";
import { buildLookupFitment, buildLookupPersonality, buildLookupInterview } from "../recruiterPreview";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import type { Scores } from "@/lib/personality";

describe("buildLookupFitment", () => {
  it("strips rank, strongPoints, weakPoints and attaches the matched role title", () => {
    const full = {
      overallScore: 82,
      rank: 3,
      categories: [],
      summary: "Good fit",
      strongPoints: ["a"],
      weakPoints: ["b"],
    } as unknown as ResumeMatchReportReady;
    const result = buildLookupFitment(full, "Data Analyst");
    expect(result).toEqual({
      report: { overallScore: 82, categories: [], summary: "Good fit" },
      matchedAgainstRoleTitle: "Data Analyst",
    });
  });
});

describe("buildLookupPersonality", () => {
  it("builds ordered traits and a top-2-trait summary paragraph", () => {
    const scores: Scores = {
      E: { pct: 40, raw: 20, band: 2 },
      A: { pct: 55, raw: 30, band: 2 },
      C: { pct: 82, raw: 45, band: 4 },
      ES: { pct: 78, raw: 42, band: 4 },
      O: { pct: 70, raw: 44, band: 3 },
    };
    const result = buildLookupPersonality(scores, "Jane Doe", "2026-07-28T09:00:00.000Z");
    expect(result.traits).toEqual([
      { key: "E", label: "Extroversion", pct: 40, bandLabel: "Average" },
      { key: "A", label: "Agreeableness", pct: 55, bandLabel: "Average" },
      { key: "C", label: "Conscientiousness", pct: 82, bandLabel: "Very High" },
      { key: "ES", label: "Emotional Stability", pct: 78, bandLabel: "Very High" },
      { key: "O", label: "Openness to Experience", pct: 70, bandLabel: "High" },
    ]);
    expect(result.summary).toBe(
      "Jane scores highest in Conscientiousness and Emotional Stability. Jane is likely to be organised, reliable and thorough — strong on deadlines, detail and follow-through. Watch-out: rigidity or perfectionism when priorities shift suddenly. Best fit: roles that reward rigour, process and accountability."
    );
    expect(result.completedAt).toBe("2026-07-28T09:00:00.000Z");
  });
});

describe("buildLookupInterview", () => {
  it("strips integrity/video/roadmap/criteria fields", () => {
    const full = {
      overallScore: 75,
      skillMetrics: { sql: 8 },
      overallSummary: "Solid performance.",
      strengths: "Strong SQL fundamentals",
      areasOfImprovement: "Communication",
      shareableReportLink: null,
      approxDurationMinutes: 20,
      flagForSuspiciousActivity: false,
      integrityCheck: "No issues.",
      videoReport: "Some private delivery notes.",
      feedbackToInterviewer: "Do not hire.",
      roadmap: "Practice window functions.",
      criteriaEvaluationTable: [],
      interviewTitle: "Data Analyst Interview",
      skillReport: { sql: { score: 8, comment: "Strong" } },
      overallSkillScore: 80,
      answers: [],
      knowledgeAnswers: [],
    } as unknown as InterviewReportReady;
    const result = buildLookupInterview(full, "2026-07-30T10:00:00.000Z");
    expect(result).toEqual({
      overallScore: 75,
      skillMetrics: { sql: 8 },
      overallSummary: "Solid performance.",
      skillReport: { sql: { score: 8, comment: "Strong" } },
      strengths: "Strong SQL fundamentals",
      completedAt: "2026-07-30T10:00:00.000Z",
      approxDurationMinutes: 20,
    });
  });
});
