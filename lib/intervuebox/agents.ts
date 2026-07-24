import { intervueBoxFetch } from "./client";

type CreateInterviewAgentResponse = {
  interviewId: string;
  title: string;
  status: string;
  maxInterviewMinutes: number;
  interviewType: string;
  isCriteriaMatch: boolean;
};

export type InterviewType = "technical" | "behavioral" | "managerial" | "hr";

export type CandidateLevel = "entry" | "mid" | "senior";

// Live-confirmed against the real API (2026-07-23): interviewType is a strict
// enum — technical, behavioral, managerial, hr — and it was previously
// hardcoded to "technical" for every role, so a Sales/HR/PM candidate got the
// same coding-style interview as a Software Engineer. Keyword-match the role
// title to pick a closer-fitting category; falls back to "technical" only
// when nothing else matches (previous behavior, now the fallback not the default).
export function inferInterviewType(roleTitle: string): InterviewType {
  const t = roleTitle.toLowerCase();
  if (/\b(hr|human resources|recruiter|recruitment|talent acquisition|people ops)\b/.test(t)) return "hr";
  if (/\b(manager|lead|head|director|vp|chief|president|founder)\b/.test(t)) return "managerial";
  if (/\b(sales|marketing|business development|account executive|customer success|support|operations|finance|legal|content)\b/.test(t)) return "behavioral";
  return "technical";
}

export function durationForLevel(level: CandidateLevel): 30 | 45 {
  return level === "senior" ? 45 : 30;
}

export async function createInterviewAgent(
  jobId: string,
  roleTitle: string,
  candidateLevel: CandidateLevel
): Promise<{ ibAgentId: string }> {
  const response = await intervueBoxFetch<CreateInterviewAgentResponse>(`/public/jobs/${jobId}/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maxInterviewMinutes: durationForLevel(candidateLevel),
      interviewType: inferInterviewType(roleTitle),
      isCriteriaMatch: false,
    }),
  });
  return { ibAgentId: response.interviewId };
}
