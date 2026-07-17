import { intervueBoxFetch } from "./client";

export type ResumeMatchCategoryKey =
  | "skillsMatch"
  | "educationMatch"
  | "experienceMatch"
  | "locationMatch"
  | "domainMatch"
  | "roleRelevance";

export type ResumeMatchCategory = {
  key: ResumeMatchCategoryKey;
  label: string;
  score: number;
  comment: string;
};

export type ResumeMatchReportReady = {
  overallScore: number;
  rank: number | null;
  categories: ResumeMatchCategory[];
  summary: string;
  strongPoints: string[];
  weakPoints: string[];
};

export type ResumeMatchReport = { status: "PENDING" } | ({ status: "READY" } & ResumeMatchReportReady);

const CATEGORY_LABELS: Record<ResumeMatchCategoryKey, string> = {
  skillsMatch: "Skills Match",
  educationMatch: "Education Match",
  experienceMatch: "Experience Match",
  locationMatch: "Location Match",
  domainMatch: "Domain Match",
  roleRelevance: "Role Relevance",
};

const CATEGORY_KEYS: ResumeMatchCategoryKey[] = [
  "skillsMatch",
  "educationMatch",
  "experienceMatch",
  "locationMatch",
  "domainMatch",
  "roleRelevance",
];

type RawResumeMatch = {
  overallScore: number;
  rank: number | null;
  summary: string;
  strongPoints: string[];
  weakPoints: string[];
} & Record<ResumeMatchCategoryKey, { score: number; comment: string }>;

type RawResumeMatchResponse = {
  applicantId: string;
  status: "PENDING" | "READY";
  resumeMatch?: RawResumeMatch;
};

export async function getResumeMatchReport(appliedJobId: string): Promise<ResumeMatchReport> {
  const response = await intervueBoxFetch<RawResumeMatchResponse>(
    `/public/reports/applicants/${appliedJobId}/resume-match`
  );

  if (response.status !== "READY" || !response.resumeMatch) {
    return { status: "PENDING" };
  }

  const match = response.resumeMatch;
  return {
    status: "READY",
    overallScore: match.overallScore,
    rank: match.rank,
    summary: match.summary,
    strongPoints: match.strongPoints,
    weakPoints: match.weakPoints,
    categories: CATEGORY_KEYS.map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      score: match[key].score,
      comment: match[key].comment,
    })),
  };
}

export function scoreOutOfTen(overallScore: number): number {
  return Math.round(overallScore) / 10;
}
