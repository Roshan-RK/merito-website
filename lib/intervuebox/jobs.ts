import { intervueBoxFetch } from "./client";

export type CreateJobInput = {
  title: string;
  jobDescription: string;
};

type CreateJobResponse = {
  success: boolean;
  jobId: string;
};

// Live-confirmed against the real API (2026-07-23): `experience` is a free-text
// field, not an enum — any string is accepted. Pulling the years-of-experience
// mention straight out of the JD (when present) instead of a hardcoded
// "Not specified" placeholder lets IntervueBox's own experienceMatch scoring
// and interview calibration reflect the actual seniority the JD asks for.
const EXPERIENCE_PATTERN = /\d{1,2}\s*(?:-|to)\s*\d{1,2}\+?\s*years?|\d{1,2}\+?\s*years?\s*(?:of\s*)?(?:experience|exp)\b/i;

export function inferExperienceFromJD(jobDescription: string): string {
  const match = jobDescription.match(EXPERIENCE_PATTERN);
  return match ? match[0].trim() : "Not specified";
}

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
      skills: [],
      education: [],
      experience: inferExperienceFromJD(input.jobDescription),
      status: "ACTIVE",
    }),
  });
  return { ibJobId: response.jobId };
}
