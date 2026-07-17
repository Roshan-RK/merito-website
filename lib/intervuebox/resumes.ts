import { intervueBoxFetch } from "./client";

type UploadResumeResponse = {
  success: boolean;
  resumeId: string;
  message: string;
};

export async function uploadResume(file: File, params: { jobId: string }): Promise<{ ibResumeId: string }> {
  const form = new FormData();
  form.set("file", file);
  form.set("jobId", params.jobId);

  const response = await intervueBoxFetch<UploadResumeResponse>("/public/resumes", {
    method: "POST",
    body: form,
  });
  return { ibResumeId: response.resumeId };
}
