import type { LookupResponse, LookupWireResponse } from "../../../shared/recruiter-preview/types";

const LOOKUP_URL = "https://www.merito.ai/api/public/recruiter-preview/lookup";

export type LookupResult =
  | { status: "found"; data: LookupResponse }
  | { status: "not_found" }
  | { status: "verification_required" }
  | { status: "error" };

/** The server sends one entry per configured role; the card only ever shows the current one. */
function flattenLookupResponse(wire: LookupWireResponse): LookupResponse {
  const role = wire.roles.find((r) => r.isCurrent) ?? wire.roles[0] ?? null;
  return {
    candidateName: wire.candidateName,
    roleTitle: role?.roleTitle ?? null,
    candidateLevel: role?.candidateLevel ?? "entry",
    sections: role ? Object.keys(role.sections) : [],
    fitment: role?.sections.fitment ?? null,
    personality: role?.sections.personality ?? null,
    interview: role?.sections.interview ?? null,
    references: null,
  };
}

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
    const wire = (await response.json()) as LookupWireResponse;
    return { status: "found", data: flattenLookupResponse(wire) };
  } catch {
    return { status: "error" };
  }
}
