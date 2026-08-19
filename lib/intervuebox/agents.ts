import { intervueBoxFetch } from "./client";

type CreateInterviewAgentResponse = {
  interviewId: string;
  title: string;
  status: string;
  maxInterviewMinutes: number;
  interviewType: string;
  isCriteriaMatch: boolean;
};

export type InterviewType = "technical" | "managerial" | "hr";

export type CandidateLevel = "entry" | "mid" | "senior";

// Live-confirmed against the real API (2026-07-23): interviewType is a strict
// enum, and it was previously hardcoded to "technical" for every role, so a
// Sales/HR/PM candidate got the same coding-style interview as a Software
// Engineer. Keyword-match the role title to pick a closer-fitting category;
// falls back to "technical" when nothing else matches.
//
// "behavioral" was removed 2026-08-18: the skill-interview mode this app
// always sends (isCriteriaMatch: false, see createInterviewAgent) only
// accepts technical/managerial/hr — the API 400s on "behavioral" — which
// silently broke every Sales/Marketing/BD/etc. candidate's invite since
// skill mode became the default on 2026-07-29.
export function inferInterviewType(roleTitle: string): InterviewType {
  const t = roleTitle.toLowerCase();
  if (/\b(hr|human resources|recruiter|recruitment|talent acquisition|people ops)\b/.test(t)) return "hr";
  if (/\b(manager|lead|head|director|vp|chief|president|founder)\b/.test(t)) return "managerial";
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
      // Flipped back to false (skill-based) 2026-07-29 — product decision:
      // skill-based is what's actually needed, not criteria-based. Confirmed
      // criteria-based (true) does populate criteriaEvaluationTable (built
      // 2026-07-28), but skill-based's own sessionDetails.skillReport table
      // (named skill + score + comment, not yet mapped anywhere in this
      // codebase) is the one actually wanted. See memory
      // intervuebox-interview-modes for the full mode comparison.
      isCriteriaMatch: false,
      // "medium" is vendor-confirmed but not mapped to candidateLevel yet —
      // full enum (low/high?) unconfirmed. Map once confirmed, per
      // specs/2026-07-24-ai-interview-difficulty-design.md's open item.
      complexity: "medium",
      isQuickApplyEnabled: true,
      // Default voice for every interview (product decision, 2026-08-19) --
      // IntervueBox's own platform default is undocumented; "en-IN-KavyaNeural"
      // ("Kavya") is a standard, non-premium voice from GET
      // /public/jobs/interview-voices, so it works on any plan tier.
      voice: "en-IN-KavyaNeural",
    }),
  });
  return { ibAgentId: response.interviewId };
}
