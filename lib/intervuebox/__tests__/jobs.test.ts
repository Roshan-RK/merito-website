import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

const extractSkillsWithLLMMock = vi.fn();
const extractJobDetailsWithLLMMock = vi.fn();
vi.mock("@/lib/claude/extractSkills", () => ({
  extractSkillsWithLLM: extractSkillsWithLLMMock,
  extractJobDetailsWithLLM: extractJobDetailsWithLLMMock,
}));

const logNewSkillsForReviewMock = vi.fn();
vi.mock("../learnedSkills", () => ({
  logNewSkillsForReview: logNewSkillsForReviewMock,
}));

describe("createJob", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
    extractSkillsWithLLMMock.mockReset();
    extractJobDetailsWithLLMMock.mockReset();
    logNewSkillsForReviewMock.mockReset();
    // Existing tests below assume the pre-LLM keyword-only behavior; default
    // to LLM unavailable so createJob falls back to inferSkillsFromJD, same
    // as before extractSkillsWithLLM existed. Dedicated LLM-path tests
    // override this per-test.
    extractSkillsWithLLMMock.mockRejectedValue(new Error("LLM unavailable in tests"));
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
    expect(inferSkillsFromJD("Looking for a React and TypeScript developer with strong SQL skills.", 15))
      .toEqual(["React", "TypeScript", "SQL"]);
  });

  it("matches case-insensitively but returns the canonical casing", async () => {
    const { inferSkillsFromJD } = await import("../jobs");
    expect(inferSkillsFromJD("must know python and product management", 15)).toEqual([
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

describe("createJob skill resolution (LLM primary, keyword fallback)", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
    extractSkillsWithLLMMock.mockReset();
    logNewSkillsForReviewMock.mockReset();
  });

  it("uses the LLM-extracted skills when the call succeeds", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    extractSkillsWithLLMMock.mockResolvedValue(["Meta Ads", "Shopify", "GA4"]);
    const { createJob } = await import("../jobs");

    await createJob({ title: "Marketing Lead", jobDescription: "Some D2C JD.", candidateLevel: "mid" });

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls.at(-1)![1].body);
    expect(sentBody.skills).toEqual(["Meta Ads", "Shopify", "GA4"]);
  });

  it("passes resumeText through to the LLM extractor for grounding", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    extractSkillsWithLLMMock.mockResolvedValue(["Partner Management"]);
    const { createJob } = await import("../jobs");

    await createJob({
      title: "Growth Leader",
      jobDescription: "Some JD.",
      candidateLevel: "mid",
      resumeText: "Built AWS partnerships. Sales background.",
    });

    expect(extractSkillsWithLLMMock).toHaveBeenCalledWith("Some JD.", 7, "Built AWS partnerships. Sales background.");
  });

  it("logs LLM-extracted skills for review on success", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    extractSkillsWithLLMMock.mockResolvedValue(["Meta Ads", "Shopify", "GA4"]);
    const { createJob } = await import("../jobs");

    await createJob({ title: "Marketing Lead", jobDescription: "Some D2C JD.", candidateLevel: "mid" });

    expect(logNewSkillsForReviewMock).toHaveBeenCalledWith(
      ["Meta Ads", "Shopify", "GA4"],
      expect.any(Array),
      "Marketing Lead"
    );
  });

  it("falls back to keyword matching when the LLM call throws", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    extractSkillsWithLLMMock.mockRejectedValue(new Error("timeout"));
    const { createJob } = await import("../jobs");

    await createJob({ title: "Engineer", jobDescription: "Need strong Python and SQL skills.", candidateLevel: "mid" });

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls.at(-1)![1].body);
    expect(sentBody.skills).toEqual(["Python", "SQL"]);
    expect(logNewSkillsForReviewMock).not.toHaveBeenCalled();
  });

  it("falls back to keyword matching when the LLM returns an empty list", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    extractSkillsWithLLMMock.mockResolvedValue([]);
    const { createJob } = await import("../jobs");

    await createJob({ title: "Engineer", jobDescription: "Need strong Python and SQL skills.", candidateLevel: "mid" });

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls.at(-1)![1].body);
    expect(sentBody.skills).toEqual(["Python", "SQL"]);
  });
});

describe("resolveJobDetails", () => {
  beforeEach(() => {
    extractJobDetailsWithLLMMock.mockReset();
    logNewSkillsForReviewMock.mockReset();
  });

  it("returns the LLM's skills and title on success", async () => {
    extractJobDetailsWithLLMMock.mockResolvedValue({ skills: ["Partner Management"], title: "Strategic Alliance Manager" });
    const { resolveJobDetails } = await import("../jobs");

    const result = await resolveJobDetails("Fallback Title", "Some JD.", "mid", "Some resume.");

    expect(result).toEqual({ skills: ["Partner Management"], title: "Strategic Alliance Manager" });
    expect(extractJobDetailsWithLLMMock).toHaveBeenCalledWith("Some JD.", 7, "Some resume.", "Fallback Title");
  });

  it("falls back to keyword skills and the given title when the LLM call throws", async () => {
    extractJobDetailsWithLLMMock.mockRejectedValue(new Error("timeout"));
    const { resolveJobDetails } = await import("../jobs");

    const result = await resolveJobDetails("Fallback Title", "Need strong Python and SQL skills.", "mid");

    expect(result).toEqual({ skills: ["Python", "SQL"], title: "Fallback Title" });
  });

  it("falls back to keyword skills and the given title when the LLM returns no skills", async () => {
    extractJobDetailsWithLLMMock.mockResolvedValue({ skills: [], title: "Some Title" });
    const { resolveJobDetails } = await import("../jobs");

    const result = await resolveJobDetails("Fallback Title", "Need strong Python and SQL skills.", "mid");

    expect(result).toEqual({ skills: ["Python", "SQL"], title: "Fallback Title" });
  });
});

describe("createJob with pre-resolved skills", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
    extractSkillsWithLLMMock.mockReset();
    logNewSkillsForReviewMock.mockReset();
  });

  it("uses the given skills directly and never calls the LLM", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    const { createJob } = await import("../jobs");

    await createJob({
      title: "Strategic Alliance Manager",
      jobDescription: "Some JD.",
      candidateLevel: "mid",
      skills: ["Partner Management", "GTM Strategy"],
    });

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls.at(-1)![1].body);
    expect(sentBody.skills).toEqual(["Partner Management", "GTM Strategy"]);
    expect(extractSkillsWithLLMMock).not.toHaveBeenCalled();
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
