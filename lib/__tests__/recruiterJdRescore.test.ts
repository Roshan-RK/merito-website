import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const resolveJobDetailsMock = vi.fn();
vi.mock("@/lib/intervuebox/jobs", () => ({
  createJob: vi.fn().mockResolvedValue({ ibJobId: "JOB_1" }),
  resolveJobDetails: resolveJobDetailsMock,
}));
vi.mock("@/lib/intervuebox/applicants", () => ({
  addApplicant: vi.fn().mockResolvedValue({ ibAppliedJobId: "APJ_1" }),
}));
vi.mock("@/lib/intervuebox/reports", () => ({
  getResumeMatchReport: vi.fn(),
}));

const maybeSingleMock = vi.fn();
const upsertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn(() => ({
  select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }),
  upsert: upsertMock,
}));
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importModule() {
  return await import("../recruiterJdRescore");
}

const CANDIDATE = {
  userId: "user-1",
  ibResumeId: "RES_1",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "9999999999",
  candidateLevel: "mid" as const,
};

describe("hashJd", () => {
  it("is deterministic and trims whitespace", async () => {
    const { hashJd } = await importModule();
    expect(hashJd("Some JD text")).toBe(hashJd("  Some JD text  "));
  });

  it("differs for different text", async () => {
    const { hashJd } = await importModule();
    expect(hashJd("JD A")).not.toBe(hashJd("JD B"));
  });
});

describe("getCachedRescore", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    fromMock.mockClear();
  });

  it("returns null when no cache row exists", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    const { getCachedRescore } = await importModule();
    expect(await getCachedRescore("user-1", "hash-1")).toBeNull();
  });

  it("returns null when the cached row isn't ready", async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: "pending", resume_match_raw: null } });
    const { getCachedRescore } = await importModule();
    expect(await getCachedRescore("user-1", "hash-1")).toBeNull();
  });

  it("returns the parsed report when the cached row is ready", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { status: "ready", resume_match_raw: { overallScore: 80, rank: null, categories: [], summary: "Good", strongPoints: [], weakPoints: [] } },
    });
    const { getCachedRescore } = await importModule();
    const result = await getCachedRescore("user-1", "hash-1");
    expect(result?.overallScore).toBe(80);
  });
});

describe("runRescore", () => {
  beforeEach(async () => {
    // recruiterJdRescore.ts reads RESCORE_POLL_INTERVAL_MS/RESCORE_MAX_WAIT_MS
    // into module-level consts at import time, so the env vars must be
    // stubbed BEFORE a fresh import evaluates them -- resetModules() first
    // forces the next `await import(...)` to re-run that top-level code.
    vi.resetModules();
    vi.stubEnv("RESCORE_POLL_INTERVAL_MS", "1");
    vi.stubEnv("RESCORE_MAX_WAIT_MS", "50");
    upsertMock.mockClear();
    resolveJobDetailsMock.mockReset().mockResolvedValue({ skills: [], title: "First line of the JD" });
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("creates a job, links the existing resume, and caches the ready report", async () => {
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockResolvedValue({
      status: "READY",
      overallScore: 91,
      rank: null,
      categories: [],
      summary: "Great fit",
      strongPoints: [],
      weakPoints: [],
    });

    const { runRescore } = await importModule();
    const result = await runRescore(CANDIDATE, "A JD about leadership", "hash-abc");

    expect(result.overallScore).toBe(91);
    const { createJob } = await import("@/lib/intervuebox/jobs");
    expect(vi.mocked(createJob)).toHaveBeenCalledWith(
      expect.objectContaining({ jobDescription: "A JD about leadership", candidateLevel: "mid" })
    );
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    expect(vi.mocked(addApplicant)).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "JOB_1", resumeId: "RES_1", name: "Jane Doe", email: "jane@example.com" })
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", jd_hash: "hash-abc", status: "ready" }),
      expect.objectContaining({ onConflict: "user_id,jd_hash" })
    );
  });

  it("passes the candidate's stored resumeText to createJob for skill grounding", async () => {
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockResolvedValue({
      status: "READY",
      overallScore: 91,
      rank: null,
      categories: [],
      summary: "Great fit",
      strongPoints: [],
      weakPoints: [],
    });

    const { runRescore } = await importModule();
    await runRescore({ ...CANDIDATE, resumeText: "Built AWS partnerships. Sales background." }, "A JD about leadership", "hash-abc");

    const { createJob } = await import("@/lib/intervuebox/jobs");
    expect(vi.mocked(createJob)).toHaveBeenCalledWith(
      expect.objectContaining({ resumeText: "Built AWS partnerships. Sales background." })
    );
  });

  it("uses the LLM-derived title from resolveJobDetails instead of the first-line heuristic", async () => {
    resolveJobDetailsMock.mockResolvedValue({ skills: ["Partner Management"], title: "Strategic Alliance Manager" });
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockResolvedValue({
      status: "READY",
      overallScore: 91,
      rank: null,
      categories: [],
      summary: "Great fit",
      strongPoints: [],
      weakPoints: [],
    });

    const { runRescore } = await importModule();
    await runRescore(CANDIDATE, "Some JD text nobody titled clearly", "hash-abc");

    const { createJob } = await import("@/lib/intervuebox/jobs");
    expect(vi.mocked(createJob)).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Strategic Alliance Manager", skills: ["Partner Management"] })
    );
  });

  it("polls until the report is ready", async () => {
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport)
      .mockResolvedValueOnce({ status: "PENDING" })
      .mockResolvedValueOnce({
        status: "READY",
        overallScore: 60,
        rank: null,
        categories: [],
        summary: "OK fit",
        strongPoints: [],
        weakPoints: [],
      });

    const { runRescore } = await importModule();
    const result = await runRescore(CANDIDATE, "Another JD", "hash-def");
    expect(result.overallScore).toBe(60);
  });

  it("throws and caches a failed status if the report never becomes ready", async () => {
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockResolvedValue({ status: "PENDING" });

    const { runRescore } = await importModule();
    await expect(runRescore(CANDIDATE, "Slow JD", "hash-ghi")).rejects.toThrow();
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
      expect.objectContaining({ onConflict: "user_id,jd_hash" })
    );
  });
});
