import { intervueBoxFetch } from "./client";

type CreateInterviewAgentResponse = {
  interviewId: string;
  title: string;
  status: string;
  maxInterviewMinutes: number;
  interviewType: string;
  isCriteriaMatch: boolean;
};

export async function createInterviewAgent(jobId: string): Promise<{ ibAgentId: string }> {
  const response = await intervueBoxFetch<CreateInterviewAgentResponse>(`/public/jobs/${jobId}/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
    }),
  });
  return { ibAgentId: response.interviewId };
}
