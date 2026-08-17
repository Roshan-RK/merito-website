import { intervueBoxFetch } from "./client";

type SendInterviewInvitationResponse = {
  success: boolean;
  invited: number;
  failed: number;
  results: { candidateId: string; success: boolean }[];
  errors?: { candidateId: string; error: string }[];
};

export async function sendInterviewInvitation(
  interviewId: string,
  candidateIds: string[]
): Promise<{ invited: number; failed: number }> {
  const response = await intervueBoxFetch<SendInterviewInvitationResponse>(
    `/public/invitations/interviews/${interviewId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds }),
    }
  );
  return { invited: response.invited, failed: response.failed };
}

// Vendor-confirmed (Krupal, 2026-08-10): separate endpoint from the initial
// invite above -- for a candidate who already has a session on this agent
// (e.g. terminated) but needs another shot at it.
export async function reinviteInterviewCandidates(
  interviewId: string,
  candidateIds: string[]
): Promise<{ invited: number; failed: number }> {
  const response = await intervueBoxFetch<SendInterviewInvitationResponse>(
    `/public/invitations/interviews/${interviewId}/reinvite`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds }),
    }
  );
  return { invited: response.invited, failed: response.failed };
}
