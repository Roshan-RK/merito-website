import type { ScrapedCandidateFields, ScoreProspectResponse, CandidateLevel } from "../../../shared/recruiter-preview/types";

const SCORE_PROSPECT_URL = "https://www.merito.ai/api/public/recruiter-preview/score-prospect";
const SCORE_PROSPECT_STATUS_URL = "https://www.merito.ai/api/public/recruiter-preview/score-prospect/status";

export type ScoreProspectResult =
  | { status: "ready"; data: ScoreProspectResponse }
  | { status: "pending"; prospectId: string }
  | { status: "verification_required" }
  | { status: "cap_exceeded" }
  | { status: "error" };

// Scoring runs in the background on the server (IntervueBox parsing +
// report generation can take up to ~2 minutes) -- this call only kicks it
// off and returns "pending" immediately in the common case. Poll
// getProspectScoreStatus for the actual result.
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
    const data = (await response.json()) as { status: "pending" | "ready"; prospectId: string; fitment?: ScoreProspectResponse["fitment"] };
    if (data.status === "pending") return { status: "pending", prospectId: data.prospectId };
    return { status: "ready", data: { prospectId: data.prospectId, fitment: data.fitment! } };
  } catch {
    return { status: "error" };
  }
}

export async function getProspectScoreStatus(prospectId: string): Promise<ScoreProspectResult> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const url = new URL(SCORE_PROSPECT_STATUS_URL);
    url.searchParams.set("prospectId", prospectId);
    const response = await fetch(url, { headers: { "x-merito-extension-key": extensionKey } });
    if (!response.ok) return { status: "error" };
    const data = (await response.json()) as { status: "pending" | "ready"; prospectId?: string; fitment?: ScoreProspectResponse["fitment"] };
    if (data.status === "pending") return { status: "pending", prospectId };
    return { status: "ready", data: { prospectId: data.prospectId!, fitment: data.fitment! } };
  } catch {
    return { status: "error" };
  }
}
