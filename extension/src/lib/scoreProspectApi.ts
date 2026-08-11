import type { ScrapedCandidateFields, ScoreProspectResponse, CandidateLevel } from "../../../shared/recruiter-preview/types";

const SCORE_PROSPECT_URL = "https://www.merito.ai/api/public/recruiter-preview/score-prospect";

export type ScoreProspectResult =
  | { status: "ready"; data: ScoreProspectResponse }
  | { status: "verification_required" }
  | { status: "cap_exceeded" }
  | { status: "error" };

export async function scoreProspect(input: {
  recruiterEmail: string;
  linkedinUrl: string;
  jdText: string;
  candidateLevel: CandidateLevel;
  candidateFields: ScrapedCandidateFields;
}): Promise<ScoreProspectResult> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const response = await fetch(SCORE_PROSPECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-merito-extension-key": extensionKey },
      body: JSON.stringify(input),
    });
    if (response.status === 403) return { status: "verification_required" };
    if (response.status === 429) return { status: "cap_exceeded" };
    if (!response.ok) return { status: "error" };
    return { status: "ready", data: (await response.json()) as ScoreProspectResponse };
  } catch {
    return { status: "error" };
  }
}
