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
