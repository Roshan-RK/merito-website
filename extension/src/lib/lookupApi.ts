import type { LookupResponse } from "../overlay/types";

const LOOKUP_URL = "https://www.merito.in/api/public/recruiter-preview/lookup";

export async function lookupCandidate(linkedinUrl: string): Promise<LookupResponse | null> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const response = await fetch(LOOKUP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-merito-extension-key": extensionKey,
      },
      body: JSON.stringify({ linkedinUrl }),
    });
    if (!response.ok) return null;
    return (await response.json()) as LookupResponse;
  } catch {
    return null;
  }
}
