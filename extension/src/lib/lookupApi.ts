import type { LookupResponse } from "../../../shared/recruiter-preview/types";

const LOOKUP_URL = "https://www.merito.ai/api/public/recruiter-preview/lookup";

export type LookupResult =
  | { status: "found"; data: LookupResponse }
  | { status: "not_found" }
  | { status: "verification_required" }
  | { status: "error" };

export async function lookupCandidate(linkedinUrl: string, recruiterEmail: string): Promise<LookupResult> {
  const extensionKey = import.meta.env.VITE_RECRUITER_EXTENSION_KEY as string;
  try {
    const response = await fetch(LOOKUP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-merito-extension-key": extensionKey,
      },
      body: JSON.stringify({ linkedinUrl, recruiterEmail }),
    });
    if (response.status === 403) return { status: "verification_required" };
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return { status: "error" };
    const data = (await response.json()) as LookupResponse;
    return { status: "found", data };
  } catch {
    return { status: "error" };
  }
}
