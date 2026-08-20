import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("durationForLevel", () => {
  it("maps entry and mid to 30 minutes", async () => {
    const { durationForLevel } = await import("../agents");
    expect(durationForLevel("entry")).toBe(30);
    expect(durationForLevel("mid")).toBe(30);
  });

  it("maps senior to 45 minutes", async () => {
    const { durationForLevel } = await import("../agents");
    expect(durationForLevel("senior")).toBe(45);
  });
});

describe("complexityForLevel", () => {
  it("maps entry to easy", async () => {
    const { complexityForLevel } = await import("../agents");
    expect(complexityForLevel("entry")).toBe("easy");
  });

  it("maps mid to medium", async () => {
    const { complexityForLevel } = await import("../agents");
    expect(complexityForLevel("mid")).toBe("medium");
  });

  it("maps senior to hard", async () => {
    const { complexityForLevel } = await import("../agents");
    expect(complexityForLevel("senior")).toBe("hard");
  });
});

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

    const result = await createInterviewAgent("JOB_123", "Software Engineer", "mid");

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
      complexity: "medium",
      isQuickApplyEnabled: true,
      voice: "en-IN-KavyaNeural",
    });
  });

  it("posts a 30-minute interview for an entry-level candidate", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      interviewId: "INT_123",
      title: "Technical Interview",
      status: "ACTIVE",
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
    });
    const { createInterviewAgent } = await import("../agents");

    const result = await createInterviewAgent("JOB_123", "Software Engineer", "entry");

    expect(result).toEqual({ ibAgentId: "INT_123" });
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
      complexity: "easy",
      isQuickApplyEnabled: true,
      voice: "en-IN-KavyaNeural",
    });
  });

  it("posts a 45-minute interview for a senior candidate", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      interviewId: "INT_124",
      title: "Technical Interview",
      status: "ACTIVE",
      maxInterviewMinutes: 45,
      interviewType: "technical",
      isCriteriaMatch: false,
    });
    const { createInterviewAgent } = await import("../agents");

    await createInterviewAgent("JOB_123", "Software Engineer", "senior");

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody.maxInterviewMinutes).toBe(45);
    expect(sentBody.complexity).toBe("hard");
  });

  it("always sends the Kavya voice", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      interviewId: "INT_1",
      title: "t",
      status: "active",
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
    });
    const { createInterviewAgent } = await import("../agents");

    await createInterviewAgent("JOB_1", "Backend Engineer", "mid");

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody.voice).toBe("en-IN-KavyaNeural");
  });
});

describe("inferInterviewType", () => {
  it("maps HR-flavored titles to hr", async () => {
    const { inferInterviewType } = await import("../agents");
    expect(inferInterviewType("HR Manager")).toBe("hr");
    expect(inferInterviewType("Talent Acquisition Specialist")).toBe("hr");
  });

  it("maps leadership titles to managerial", async () => {
    const { inferInterviewType } = await import("../agents");
    expect(inferInterviewType("Engineering Manager")).toBe("managerial");
    expect(inferInterviewType("Director of Operations")).toBe("managerial");
  });

  it("falls back to technical for engineering-flavored titles", async () => {
    const { inferInterviewType } = await import("../agents");
    expect(inferInterviewType("Backend Developer")).toBe("technical");
    expect(inferInterviewType("Data Scientist")).toBe("technical");
  });

  it("falls back to technical for non-technical individual-contributor titles (behavioral is not a valid skill-interview type)", async () => {
    const { inferInterviewType } = await import("../agents");
    expect(inferInterviewType("Sales Executive")).toBe("technical");
    expect(inferInterviewType("Content Writer")).toBe("technical");
  });
});
