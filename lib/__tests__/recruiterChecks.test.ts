import { describe, it, expect, vi, beforeEach } from "vitest";

const prospectCountMock = vi.fn();
const candidateCountMock = vi.fn();
const insertMock = vi.fn().mockResolvedValue({ error: null });

function countChain(mock: () => { count: number }) {
  return {
    select: () => ({
      eq: () => ({
        gte: () => ({ then: (resolve: (v: { count: number }) => void) => resolve(mock()) }),
      }),
    }),
  };
}

const fromMock = vi.fn((table: string) => {
  if (table === "recruiter_sourced_prospects") return countChain(prospectCountMock);
  if (table === "recruiter_candidate_checks") return { ...countChain(candidateCountMock), insert: insertMock };
  throw new Error(`unexpected table ${table}`);
});
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from: fromMock }) }));

async function importModule() {
  return await import("../recruiterChecks");
}

beforeEach(() => {
  prospectCountMock.mockReset().mockReturnValue({ count: 0 });
  candidateCountMock.mockReset().mockReturnValue({ count: 0 });
  insertMock.mockClear().mockResolvedValue({ error: null });
});

describe("getMonthlyCheckCount", () => {
  it("sums prospect and candidate check counts for the same recruiter", async () => {
    prospectCountMock.mockReturnValue({ count: 4 });
    candidateCountMock.mockReturnValue({ count: 3 });
    const { getMonthlyCheckCount } = await importModule();
    const count = await getMonthlyCheckCount("Recruiter@Example.com");
    expect(count).toBe(7);
  });

  it("counts toward the cap from 10 prospect rows alone, with zero candidate-check rows", async () => {
    prospectCountMock.mockReturnValue({ count: 10 });
    candidateCountMock.mockReturnValue({ count: 0 });
    const { getMonthlyCheckCount, MONTHLY_CHECK_CAP } = await importModule();
    const count = await getMonthlyCheckCount("recruiter@example.com");
    expect(count).toBeGreaterThanOrEqual(MONTHLY_CHECK_CAP);
  });

  it("counts toward the cap from 10 candidate-check rows alone, with zero prospect rows", async () => {
    prospectCountMock.mockReturnValue({ count: 0 });
    candidateCountMock.mockReturnValue({ count: 10 });
    const { getMonthlyCheckCount, MONTHLY_CHECK_CAP } = await importModule();
    const count = await getMonthlyCheckCount("recruiter@example.com");
    expect(count).toBeGreaterThanOrEqual(MONTHLY_CHECK_CAP);
  });
});

describe("recordCandidateCheck", () => {
  it("inserts a row with a lowercased recruiter email", async () => {
    const { recordCandidateCheck } = await importModule();
    await recordCandidateCheck("Recruiter@Example.com", "user-1", "hash-1");
    expect(insertMock).toHaveBeenCalledWith({
      recruiter_email: "recruiter@example.com",
      user_id: "user-1",
      jd_hash: "hash-1",
    });
  });
});
