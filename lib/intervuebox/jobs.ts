import { intervueBoxFetch } from "./client";

export type CreateJobInput = {
  title: string;
  jobDescription: string;
};

type CreateJobResponse = {
  success: boolean;
  jobId: string;
};

export async function createJob(input: CreateJobInput): Promise<{ ibJobId: string }> {
  const response = await intervueBoxFetch<CreateJobResponse>("/public/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      location: ["Remote"],
      jobType: "Full-time",
      industry: "General",
      designation: input.title,
      department: "General",
      openings: 1,
      jobDescription: input.jobDescription,
    }),
  });
  return { ibJobId: response.jobId };
}
