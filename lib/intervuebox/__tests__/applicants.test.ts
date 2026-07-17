import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("addApplicant", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("posts required applicant fields with Merito's placeholder defaults and returns the applicant id", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      applicantId: "APJ_123",
      jobId: "JOB_123",
      candidateId: "USR_123",
      createdAt: "2026-07-17T00:00:00Z",
    });
    const { addApplicant } = await import("../applicants");

    const result = await addApplicant({
      jobId: "JOB_123",
      resumeId: "RES_123",
      name: "Jane Doe",
      email: "jane@example.com",
      phoneNumber: "+919876543210",
    });

    expect(result).toEqual({ ibAppliedJobId: "APJ_123" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/jobs/JOB_123/applicants",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({
      resumeId: "RES_123",
      name: "Jane Doe",
      email: "jane@example.com",
      phoneNumber: "+919876543210",
      currentCtc: "Not specified",
      expectedCtc: "Not specified",
      willingToRelocate: "Not specified",
      hearAboutUs: "Merito HUB",
      noticePeriod: "Not specified",
    });
  });
});
