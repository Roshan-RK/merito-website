import { TRAIT_NAME, TRAIT_WORK_IMPLICATION, BANDS, traitLevel, type Scores, type TraitKey } from "@/lib/personality";
import type { ResumeMatchReportReady, ResumeMatchCategory } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";

export type LookupFitmentReport = {
  overallScore: number;
  categories: ResumeMatchCategory[];
  summary: string;
};

export type LookupFitment = {
  report: LookupFitmentReport;
  matchedAgainstRoleTitle: string;
};

export type LookupInterview = {
  overallScore: number;
  skillMetrics: Record<string, number>;
  overallSummary: string;
  skillReport: Record<string, { score: number; comment: string }>;
  strengths: string | null;
  completedAt: string;
  approxDurationMinutes: number | null;
};

export type LookupPersonalityTrait = {
  key: TraitKey;
  label: string;
  pct: number;
  bandLabel: string;
};

export type LookupPersonality = {
  traits: LookupPersonalityTrait[];
  summary: string;
  completedAt: string | null;
};

const TRAIT_ORDER: TraitKey[] = ["E", "A", "C", "ES", "O"];

function buildPersonalitySummary(candidateName: string, traits: LookupPersonalityTrait[]): string {
  const firstName = candidateName.split(/\s+/)[0] || candidateName;
  const sorted = [...traits].sort((a, b) => b.pct - a.pct);
  const top = sorted[0];
  const second = sorted[1];
  if (!top || !second) return "";
  const workLine = TRAIT_WORK_IMPLICATION[top.key][traitLevel(top.pct)](firstName);
  return `${firstName} scores highest in ${top.label} and ${second.label}. ${workLine}`;
}

export function buildLookupFitment(fullFitment: ResumeMatchReportReady, roleTitle: string): LookupFitment {
  return {
    report: {
      overallScore: fullFitment.overallScore,
      categories: fullFitment.categories,
      summary: fullFitment.summary,
    },
    matchedAgainstRoleTitle: roleTitle,
  };
}

export function buildLookupPersonality(scores: Scores, candidateName: string, completedAt: string | null): LookupPersonality {
  const traits = TRAIT_ORDER.filter((key) => scores[key]).map((key) => ({
    key,
    label: TRAIT_NAME[key],
    pct: scores[key].pct,
    bandLabel: BANDS[scores[key].band],
  }));
  return {
    traits,
    summary: buildPersonalitySummary(candidateName, traits),
    completedAt,
  };
}

export function buildLookupInterview(full: InterviewReportReady, completedAt: string): LookupInterview {
  return {
    overallScore: full.overallScore,
    skillMetrics: full.skillMetrics,
    overallSummary: full.overallSummary,
    skillReport: full.skillReport,
    strengths: full.strengths,
    completedAt,
    approxDurationMinutes: full.approxDurationMinutes,
  };
}
