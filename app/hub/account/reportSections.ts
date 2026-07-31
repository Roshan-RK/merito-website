export type ReportType = "fitment" | "personality" | "interview" | "references";

export type InterviewSection =
  | "scoreGauge"
  | "overview"
  | "skillReport"
  | "criteriaMatch"
  | "skillEvaluation"
  | "strengths"
  | "integrity"
  | "recommendation"
  | "roadmap";

export const INTERVIEW_SECTIONS: { key: InterviewSection; label: string }[] = [
  { key: "scoreGauge", label: "Score & delivery parameters" },
  { key: "overview", label: "AI overview summary" },
  { key: "skillReport", label: "Skill-wise score table" },
  { key: "criteriaMatch", label: "Criteria match summary" },
  { key: "skillEvaluation", label: "Skill-wise evaluation detail" },
  { key: "strengths", label: "What the interview evidenced" },
  { key: "integrity", label: "Integrity assessment" },
  { key: "recommendation", label: "AI recommendation (blunt hire/no-hire verdict)" },
  { key: "roadmap", label: "Improvement roadmap" },
];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  fitment: "Fitment report",
  personality: "Personality report",
  interview: "AI interview report",
  references: "Reference check report",
};
