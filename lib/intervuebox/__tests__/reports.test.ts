import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("getResumeMatchReport", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("returns PENDING when the report isn't ready yet", async () => {
    intervueBoxFetchMock.mockResolvedValue({ applicantId: "APJ_123", status: "PENDING" });
    const { getResumeMatchReport } = await import("../reports");

    const result = await getResumeMatchReport("APJ_123");

    expect(result).toEqual({ status: "PENDING" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith("/public/reports/applicants/APJ_123/resume-match");
  });

  it("maps the READY resumeMatch payload into the six labeled categories", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      applicantId: "APJ_123",
      status: "READY",
      resumeMatch: {
        skillsMatch: { score: 85, comment: "Strong match on core skills" },
        educationMatch: { score: 90, comment: "Meets education requirement" },
        experienceMatch: { score: 78, comment: "5 years vs 5+ required" },
        locationMatch: { score: 100, comment: "Same location" },
        domainMatch: { score: 80, comment: "Relevant domain experience" },
        roleRelevance: { score: 82, comment: "Closely aligned to the role" },
        summary: "Overall a strong fit for the role.",
        strongPoints: ["5+ years in backend engineering"],
        weakPoints: ["No direct experience with Kubernetes"],
        overallScore: 82,
        rank: 1,
      },
    });
    const { getResumeMatchReport } = await import("../reports");

    const result = await getResumeMatchReport("APJ_123");

    expect(result).toEqual({
      status: "READY",
      overallScore: 82,
      rank: 1,
      summary: "Overall a strong fit for the role.",
      strongPoints: ["5+ years in backend engineering"],
      weakPoints: ["No direct experience with Kubernetes"],
      categories: [
        { key: "skillsMatch", label: "Skills Match", score: 85, comment: "Strong match on core skills" },
        { key: "educationMatch", label: "Education Match", score: 90, comment: "Meets education requirement" },
        { key: "experienceMatch", label: "Experience Match", score: 78, comment: "5 years vs 5+ required" },
        { key: "locationMatch", label: "Location Match", score: 100, comment: "Same location" },
        { key: "domainMatch", label: "Domain Match", score: 80, comment: "Relevant domain experience" },
        { key: "roleRelevance", label: "Role Relevance", score: 82, comment: "Closely aligned to the role" },
      ],
    });
  });
});

describe("scoreOutOfTen", () => {
  it("converts a 0-100 score to a 0-10 score with one decimal", async () => {
    const { scoreOutOfTen } = await import("../reports");
    expect(scoreOutOfTen(82)).toBe(8.2);
    expect(scoreOutOfTen(78.4)).toBe(7.8);
  });
});
