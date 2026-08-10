import type { RescoreResponse } from "../../../shared/recruiter-preview/types";

const RESCORE_URL = "https://www.merito.ai/api/public/recruiter-preview/rescore";

export async function rescoreCandidate(linkedinUrl: string, jdText: string): Promise<RescoreResponse | null> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const response = await fetch(RESCORE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-merito-extension-key": extensionKey,
      },
      body: JSON.stringify({ linkedinUrl, jdText }),
    });
    if (!response.ok) return null;
    return (await response.json()) as RescoreResponse;
  } catch {
    return null;
  }
}
