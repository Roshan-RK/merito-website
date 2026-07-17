import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("createJob", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("posts job defaults and returns the created job id", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    const { createJob } = await import("../jobs");

    const result = await createJob({ title: "Senior Product Manager", jobDescription: "Ship things." });

    expect(result).toEqual({ ibJobId: "JOB_123" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/jobs",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({
      title: "Senior Product Manager",
      location: ["Remote"],
      jobType: "Full-time",
      industry: "General",
      designation: "Senior Product Manager",
      department: "General",
      openings: 1,
      jobDescription: "Ship things.",
    });
  });
});
