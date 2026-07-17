import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("uploadResume", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("forwards the raw file as multipart form data with the job id and returns the resume id", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, resumeId: "RES_123", message: "ok" });
    const { uploadResume } = await import("../resumes");
    const file = new File([new Uint8Array([1, 2, 3])], "resume.pdf", { type: "application/pdf" });

    const result = await uploadResume(file, { jobId: "JOB_123" });

    expect(result).toEqual({ ibResumeId: "RES_123" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/resumes",
      expect.objectContaining({ method: "POST" })
    );
    const sentForm = intervueBoxFetchMock.mock.calls[0][1].body as FormData;
    expect(sentForm.get("file")).toBe(file);
    expect(sentForm.get("jobId")).toBe("JOB_123");
  });
});
