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

describe("getCandidateResumeDetails", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("maps phoneNumber, location, and totalExperience from the real API shape", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      candidateDetails: {
        name: "Kavita Menon",
        email: "roshanrk2014@gmail.com",
        phoneNumber: "+919876543210",
        location: "India",
        totalExperience: 6,
        skills: ["Employee Relations"],
        education: [],
        experience: [],
        projects: [
          {
            Name: "Applicant Tracking Dashboard",
            Description: "Built an internal dashboard for tracking applicants.",
            Technologies: ["React", "Node.js"],
            Link: "",
          },
        ],
        achievements: { Certifications: [] },
      },
    });
    const { getCandidateResumeDetails } = await import("../reports");

    const result = await getCandidateResumeDetails("AJ_123");

    expect(result).toEqual({
      skills: ["Employee Relations"],
      education: [],
      experience: [],
      certifications: [],
      projects: [
        {
          name: "Applicant Tracking Dashboard",
          description: "Built an internal dashboard for tracking applicants.",
          technologies: ["React", "Node.js"],
          link: "",
        },
      ],
      phoneNumber: "+919876543210",
      location: "India",
      totalExperience: 6,
    });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith("/public/reports/applicants/AJ_123/resume");
  });

  it("returns null for phoneNumber/location/totalExperience when the API omits them", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      candidateDetails: { skills: [], education: [], experience: [] },
    });
    const { getCandidateResumeDetails } = await import("../reports");

    const result = await getCandidateResumeDetails("AJ_123");

    expect(result.phoneNumber).toBeNull();
    expect(result.location).toBeNull();
    expect(result.totalExperience).toBeNull();
  });

  it("defaults projects to [] when the API omits it", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      candidateDetails: { skills: [], education: [], experience: [] },
    });
    const { getCandidateResumeDetails } = await import("../reports");

    const result = await getCandidateResumeDetails("AJ_123");

    expect(result.projects).toEqual([]);
  });
});

describe("scoreOutOfTen", () => {
  it("converts a 0-100 score to a 0-10 score with one decimal", async () => {
    const { scoreOutOfTen } = await import("../reports");
    expect(scoreOutOfTen(82)).toBe(8.2);
    expect(scoreOutOfTen(78.4)).toBe(7.8);
  });
});
