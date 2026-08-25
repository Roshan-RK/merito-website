import type { RescoreResponse } from "../../../shared/recruiter-preview/types";

const RESCORE_URL = "https://www.merito.ai/api/public/recruiter-preview/rescore";

export type RescoreResult =
  | { status: "ready"; fitment: NonNullable<RescoreResponse["fitment"]> }
  | { status: "cap_exceeded" }
  | { status: "verification_required" }
  | { status: "error" };

export async function rescoreCandidate(linkedinUrl: string, jdText: string, recruiterEmail: string): Promise<RescoreResult> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const response = await fetch(RESCORE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-merito-extension-key": extensionKey,
      },
      body: JSON.stringify({ linkedinUrl, jdText, recruiterEmail }),
    });
    if (response.status === 403) return { status: "verification_required" };
    if (response.status === 429) return { status: "cap_exceeded" };
    if (!response.ok) return { status: "error" };
    const data = (await response.json()) as RescoreResponse;
    if (!data.fitment) return { status: "error" };
    return { status: "ready", fitment: data.fitment };
  } catch {
    return { status: "error" };
  }
}
