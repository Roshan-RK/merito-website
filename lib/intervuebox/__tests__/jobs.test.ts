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
      skills: [],
      education: [],
      experience: "Not specified",
      status: "ACTIVE",
    });
  });

  it("pulls the years-of-experience mention out of the JD instead of the placeholder", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    const { createJob } = await import("../jobs");

    await createJob({ title: "Senior Product Manager", jobDescription: "Looking for someone with 5-8 years of experience." });

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody.experience).toBe("5-8 years");
  });
});

describe("inferExperienceFromJD", () => {
  it("extracts a years-of-experience range", async () => {
    const { inferExperienceFromJD } = await import("../jobs");
    expect(inferExperienceFromJD("Requires 3-5 years of experience in sales.")).toBe("3-5 years");
  });

  it("extracts a plus-form years mention", async () => {
    const { inferExperienceFromJD } = await import("../jobs");
    expect(inferExperienceFromJD("10+ years experience required.")).toBe("10+ years experience");
  });

  it("falls back to Not specified when no mention exists", async () => {
    const { inferExperienceFromJD } = await import("../jobs");
    expect(inferExperienceFromJD("We need a great communicator.")).toBe("Not specified");
  });
});
