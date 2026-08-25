import type { LookupResponse, LookupWireResponse } from "../../../shared/recruiter-preview/types";

const LOOKUP_URL = "https://www.merito.ai/api/public/recruiter-preview/lookup";

export type LookupResult =
  | { status: "found"; data: LookupWireResponse }
  | { status: "not_found" }
  | { status: "verification_required" }
  | { status: "error" };

/** Picks one role's data out of the server's roles[] and flattens it to the render shape. */
export function flattenLookupRole(wire: LookupWireResponse, leadId?: string | null): LookupResponse {
  const role =
    wire.roles.find((r) => r.leadId === leadId) ?? wire.roles.find((r) => r.isCurrent) ?? wire.roles[0] ?? null;
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

/** Picks a section to display: the requested one if the role actually has it, otherwise the role's first available section (falls back to "fitment" if the role has none at all). */
export function pickActiveSection(sections: string[], requested: string): string {
  if (sections.includes(requested)) return requested;
  return sections[0] ?? "fitment";
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
    return { status: "found", data: wire };
  } catch {
    return { status: "error" };
  }
}
