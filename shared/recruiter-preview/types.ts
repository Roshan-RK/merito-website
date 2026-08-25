export type ResumeMatchCategory = {
  key: "skillsMatch" | "educationMatch" | "experienceMatch" | "locationMatch" | "domainMatch" | "roleRelevance";
  label: string;
  score: number;
  comment: string;
};

export type TraitKey = "E" | "A" | "C" | "ES" | "O";

export type PersonalityTrait = {
  key: TraitKey;
  label: string;
  pct: number;
  bandLabel: string;
};

export type CandidateLevel = "entry" | "mid" | "senior";

export type LookupResponse = {
  candidateName: string;
  roleTitle: string | null;
  candidateLevel: CandidateLevel;
  sections: string[];
  fitment: {
    report: {
      overallScore: number;
      categories: ResumeMatchCategory[];
      summary: string;
    };
    matchedAgainstRoleTitle: string;
  } | null;
  personality: { traits: PersonalityTrait[]; summary: string; completedAt: string | null } | null;
  interview: {
    overallScore: number;
    skillMetrics: Record<string, number>;
    overallSummary: string;
    skillReport: Record<string, { score: number; comment: string }>;
    strengths: string | null;
    completedAt: string;
    approxDurationMinutes: number | null;
  } | null;
  references: {
    overallScore: number;
    categoryScores: { category: string; label: string; value: number }[];
    referees: { name: string; role: string; organization: string | null; overallFeedback: string | null }[];
  } | null;
};

// What the lookup endpoint actually sends on the wire (one entry per role
// the candidate has configured recruiter-preview sections for). Client code
// flattens this to `LookupResponse` (the shape the render components use)
// via a selected leadId, falling back to the `isCurrent` role -- see
// flattenLookupRole in lookupApi.ts.
export type LookupRoleEntry = {
  leadId: string;
  roleTitle: string | null;
  isCurrent: boolean;
  candidateLevel: CandidateLevel;
  sections: {
    fitment?: LookupResponse["fitment"];
    personality?: LookupResponse["personality"];
    interview?: LookupResponse["interview"];
  };
};

export type LookupWireResponse = {
  candidateName: string;
  roles: LookupRoleEntry[];
};

export type AvailableRole = Pick<LookupRoleEntry, "leadId" | "roleTitle">;

export type RescoreResponse = { fitment: LookupResponse["fitment"] };

export type RevealContactResponse = { email: string };

export type ScrapedCandidateFields = {
  name: string;
  headline: string;
  experience: { title: string; company: string; duration: string; description: string }[];
  education: { school: string; degree: string; duration: string }[];
  skills: string[];
};

export type ScoreProspectResponse = { prospectId: string; fitment: LookupResponse["fitment"] };
