export type ResumeMatchCategory = {
  key: "skillsMatch" | "educationMatch" | "experienceMatch" | "locationMatch" | "domainMatch" | "roleRelevance";
  label: string;
  score: number;
  comment: string;
};

export type TraitKey = "E" | "A" | "C" | "ES" | "O";
export type TraitScore = { raw: number; pct: number; band: number };
export type Scores = Record<TraitKey, TraitScore>;

export type CriteriaMatchStatus = "Matched" | "Partially Matched" | "Not Matched";
export type CriteriaEvaluationEntry = { criteria: string; status: CriteriaMatchStatus; reason: string };

export type LookupResponse = {
  candidateName: string;
  roleTitle: string | null;
  sections: string[];
  fitment: {
    report: {
      overallScore: number;
      rank: number | null;
      categories: ResumeMatchCategory[];
      summary: string;
      strongPoints: string[];
      weakPoints: string[];
    };
    matchedAgainstRoleTitle: string;
  } | null;
  personality: { scores: Scores; completedAt: string | null } | null;
  interview: {
    overallScore: number;
    skillMetrics: Record<string, number>;
    overallSummary: string;
    skillReport: Record<string, { score: number; comment: string }>;
    criteriaEvaluationTable: CriteriaEvaluationEntry[];
    strengths: string | null;
    roadmap: string | null;
    completedAt: string;
    approxDurationMinutes: number | null;
  } | null;
  references: {
    overallScore: number;
    categoryScores: { category: string; label: string; value: number }[];
    referees: { name: string; role: string; organization: string | null; overallFeedback: string | null }[];
  } | null;
};
