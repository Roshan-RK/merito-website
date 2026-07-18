import { intervueBoxFetch } from "./client";

export type AddApplicantInput = {
  jobId: string;
  resumeId: string;
  name: string;
  email: string;
  phoneNumber: string;
};

type AddApplicantResponse = {
  applicantId: string;
  jobId: string;
  candidateId: string;
  createdAt: string;
};

export async function addApplicant(input: AddApplicantInput): Promise<{ ibAppliedJobId: string }> {
  const response = await intervueBoxFetch<AddApplicantResponse>(`/public/jobs/${input.jobId}/applicants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resumeId: input.resumeId,
      name: input.name,
      email: input.email,
      phoneNumber: input.phoneNumber,
      currentCtc: "Not specified",
      expectedCtc: "Not specified",
      willingToRelocate: "Not specified",
      hearAboutUs: "Merito HUB",
      noticePeriod: "Not specified",
    }),
  });
  return { ibAppliedJobId: response.applicantId };
}

type GetApplicantResponse = {
  applicantId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
};

export async function getApplicant(appliedJobId: string): Promise<{ candidateId: string }> {
  const response = await intervueBoxFetch<GetApplicantResponse>(`/public/applicants/${appliedJobId}`);
  return { candidateId: response.candidateId };
}
