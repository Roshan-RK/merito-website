import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("createInterviewAgent", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("posts default interview settings and returns the interview id", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      interviewId: "INT_123",
      title: "Technical Interview",
      status: "ACTIVE",
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
    });
    const { createInterviewAgent } = await import("../agents");

    const result = await createInterviewAgent("JOB_123");

    expect(result).toEqual({ ibAgentId: "INT_123" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/jobs/JOB_123/interview",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
    });
  });
});
