import { intervueBoxFetch } from "./client";

type InvitationResult = { candidateId: string; success: boolean; magicLink?: string; magicLinkExpiresAt?: string };
type InvitationError = { candidateId: string; error: string };

type SendInterviewInvitationResponse = {
  success: boolean;
  invited: number;
  failed: number;
  results: InvitationResult[];
  errors?: InvitationError[];
};

export async function sendInterviewInvitation(
  interviewId: string,
  candidateIds: string[]
): Promise<{ invited: number; failed: number; magicLink: string | null; magicLinkExpiresAt: string | null }> {
  const response = await intervueBoxFetch<SendInterviewInvitationResponse>(
    `/public/invitations/interviews/${interviewId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // MAGIC_LINK is the only access mode this app sends (product decision,
      // 2026-08-19) -- no CREDENTIALS path retained.
      body: JSON.stringify({ candidateIds, accessMode: "MAGIC_LINK" }),
    }
  );
  const first = response.results[0];
  return {
    invited: response.invited,
    failed: response.failed,
    magicLink: first?.magicLink ?? null,
    magicLinkExpiresAt: first?.magicLinkExpiresAt ?? null,
  };
}

type ReinviteMagicLink = { candidateId: string; magicLink: string; expiresAt: string };

type ReinviteResponse = {
  success: boolean;
  mode: "REINVITE" | "RESUME";
  accessModes: string[];
  reinvited: number;
  failed: number;
  candidateIds: string[];
  magicLinks?: ReinviteMagicLink[];
  errors?: InvitationError[];
};

// Vendor-confirmed (Krupal, 2026-08-10): separate endpoint from the initial
// invite above -- for a candidate who already has a session on this agent
// (e.g. terminated) but needs another shot at it. mode defaults to REINVITE
// (discards progress, fresh start) so the existing admin free-resend call
// site (app/api/admin/interviews/[id]/reinvite/route.ts) keeps compiling and
// behaving unchanged. mode: "RESUME" re-opens the interview keeping saved
// progress instead.
export async function reinviteInterviewCandidates(
  interviewId: string,
  candidateIds: string[],
  mode: "REINVITE" | "RESUME" = "REINVITE"
): Promise<{ invited: number; failed: number; magicLinks?: ReinviteMagicLink[]; errors?: InvitationError[] }> {
  const response = await intervueBoxFetch<ReinviteResponse>(
    `/public/invitations/interviews/${interviewId}/reinvite`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds, mode }),
    }
  );
  return {
    invited: response.reinvited,
    failed: response.failed,
    magicLinks: response.magicLinks,
    errors: response.errors,
  };
}
