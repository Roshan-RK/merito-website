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

    const result = await createJob({ title: "Senior Product Manager", jobDescription: "Ship things.", candidateLevel: "mid" });

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

    await createJob({ title: "Senior Product Manager", jobDescription: "Looking for someone with 5-8 years of experience.", candidateLevel: "senior" });

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody.experience).toBe("5-8 years");
  });
});

describe("inferSkillsFromJD", () => {
  it("extracts matching skill keywords from the JD text", async () => {
    const { inferSkillsFromJD } = await import("../jobs");
    expect(inferSkillsFromJD("Looking for a React and TypeScript developer with strong SQL skills."))
      .toEqual(["TypeScript", "React", "SQL"]);
  });

  it("matches case-insensitively but returns the canonical casing", async () => {
    const { inferSkillsFromJD } = await import("../jobs");
    expect(inferSkillsFromJD("must know python and product management")).toEqual([
      "Python",
      "Product Management",
    ]);
  });

  it("returns an empty array when no keywords match", async () => {
    const { inferSkillsFromJD } = await import("../jobs");
    expect(inferSkillsFromJD("We need someone great.", 15)).toEqual([]);
  });

  it("caps results at the max count", async () => {
    const { inferSkillsFromJD } = await import("../jobs");
    const jd = "JavaScript TypeScript Python Java React Next.js Node.js SQL AWS Docker Kubernetes Go Rust C++ C#";
    expect(inferSkillsFromJD(jd, 5)).toHaveLength(5);
  });

  it("createJob passes the inferred skills through in the request body", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    const { createJob } = await import("../jobs");

    await createJob({ title: "Engineer", jobDescription: "Need strong Python and SQL skills.", candidateLevel: "mid" });

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls.at(-1)![1].body);
    expect(sentBody.skills).toEqual(["Python", "SQL"]);
  });
});

describe("maxSkillsForLevel", () => {
  it("caps entry and mid level at 7 skills (30-min interview slot)", async () => {
    const { maxSkillsForLevel } = await import("../jobs");
    expect(maxSkillsForLevel("entry")).toBe(7);
    expect(maxSkillsForLevel("mid")).toBe(7);
  });

  it("caps senior level at 10 skills (45-min interview slot)", async () => {
    const { maxSkillsForLevel } = await import("../jobs");
    expect(maxSkillsForLevel("senior")).toBe(10);
  });

  it("createJob truncates inferred skills to the level's cap", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    const { createJob } = await import("../jobs");
    const jd = "JavaScript TypeScript Python Java React Next.js Node.js SQL AWS Docker Kubernetes Go Rust C++ C#";

    await createJob({ title: "Engineer", jobDescription: jd, candidateLevel: "mid" });

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls.at(-1)![1].body);
    expect(sentBody.skills).toHaveLength(7);
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
