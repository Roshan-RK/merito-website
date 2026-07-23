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

export type CandidateEducation = {
  qualification: string;
  college: string;
  location: string;
  duration: string;
};

export type CandidateExperience = {
  position: string;
  company: string;
  duration: string;
  summary: string;
};

export type CandidateResumeDetails = {
  skills: string[];
  education: CandidateEducation[];
  experience: CandidateExperience[];
  certifications: string[];
  phoneNumber: string | null;
  location: string | null;
  totalExperience: number | null;
};

// Separate from the resume-match report above — requires the "Get Applicant
// Resume Report" API key scope (not "Get Resume Match Report"). Returns the
// parsed candidate profile (skills, education, experience, certifications)
// that backs IntervueBox's own PDF export, which our resume-match report
// doesn't include. See open item #10 in
// specs/2026-07-17-intervuebox-integration-design.md.
type RawCandidateResumeResponse = {
  candidateDetails: {
    skills?: string[];
    education?: Array<{ Qualification: string; College: string; Location: string; Duration: string }>;
    experience?: Array<{ Position: string; Company: string; Years_of_experience: string; Summary: string }>;
    achievements?: { Certifications?: string[] };
    phoneNumber?: string;
    location?: string;
    totalExperience?: number;
  };
};

export async function getCandidateResumeDetails(appliedJobId: string): Promise<CandidateResumeDetails> {
  const response = await intervueBoxFetch<RawCandidateResumeResponse>(
    `/public/reports/applicants/${appliedJobId}/resume`
  );
  const details = response.candidateDetails;
  return {
    skills: details.skills ?? [],
    education: (details.education ?? []).map((e) => ({
      qualification: e.Qualification,
      college: e.College,
      location: e.Location,
      duration: e.Duration,
    })),
    experience: (details.experience ?? []).map((e) => ({
      position: e.Position,
      company: e.Company,
      duration: e.Years_of_experience,
      summary: e.Summary,
    })),
    certifications: details.achievements?.Certifications ?? [],
    phoneNumber: details.phoneNumber ?? null,
    location: details.location ?? null,
    totalExperience: details.totalExperience ?? null,
  };
}
