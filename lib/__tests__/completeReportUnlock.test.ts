import { describe, it, expect, vi, beforeEach } from "vitest";

const unlockReportMock = vi.fn();
vi.mock("@/lib/reportUnlocks", () => ({
  unlockReport: unlockReportMock,
}));

const unlockProductMock = vi.fn();
vi.mock("@/lib/productUnlocks", () => ({
  unlockProduct: unlockProductMock,
}));

const getResumeMatchReportMock = vi.fn();
vi.mock("@/lib/intervuebox/reports", () => ({
  getResumeMatchReport: getResumeMatchReportMock,
  scoreOutOfTen: (overallScore: number) => Math.round(overallScore * 10) / 100,
}));

const updateEqMock = vi.fn();
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
const fromMock = vi.fn().mockReturnValue({ update: updateMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("completeReportUnlock", () => {
  beforeEach(() => {
    unlockReportMock.mockReset();
    unlockReportMock.mockResolvedValue(undefined);
    unlockProductMock.mockReset();
    unlockProductMock.mockResolvedValue(undefined);
    getResumeMatchReportMock.mockReset();
    updateEqMock.mockReset();
    updateEqMock.mockResolvedValue({ error: null });
    updateMock.mockClear();
    fromMock.mockClear();
  });

  it("returns an error result when unlockReport throws", async () => {
    unlockReportMock.mockRejectedValue(new Error("db error"));
    const { completeReportUnlock } = await import("../completeReportUnlock");

    const result = await completeReportUnlock("user-1", {
      id: "lead-1",
      role_title: "Senior Product Manager",
      ib_applied_job_id: "APJ_1",
      resume_match_status: "PENDING",
      resume_match_raw: null,
    });

    expect(result).toEqual({ status: "error", message: "Something went wrong unlocking the report." });
    expect(getResumeMatchReportMock).not.toHaveBeenCalled();
  });

  it("returns the stored report directly when already READY, without re-fetching", async () => {
    const storedRaw = { overallScore: 78, rank: 1, categories: [], summary: "Good fit.", strongPoints: [], weakPoints: [] };
    const { completeReportUnlock } = await import("../completeReportUnlock");

    const result = await completeReportUnlock("user-1", {
      id: "lead-1",
      role_title: "Senior Product Manager",
      ib_applied_job_id: "APJ_1",
      resume_match_status: "READY",
      resume_match_raw: storedRaw,
    });

    expect(unlockReportMock).toHaveBeenCalledWith("user-1", "lead-1", "Senior Product Manager");
    expect(getResumeMatchReportMock).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "unlocked", report: storedRaw });
  });

  it("re-fetches, saves, and returns unlocked when the stored status was PENDING and the report is now ready", async () => {
    getResumeMatchReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 82,
      rank: 1,
      categories: [],
      summary: "Strong overall fit.",
      strongPoints: ["Skill A"],
      weakPoints: ["Gap A"],
    });
    const { completeReportUnlock } = await import("../completeReportUnlock");

    const result = await completeReportUnlock("user-1", {
      id: "lead-1",
      role_title: "Senior Product Manager",
      ib_applied_job_id: "APJ_1",
      resume_match_status: "PENDING",
      resume_match_raw: null,
    });

    expect(fromMock).toHaveBeenCalledWith("fitment_leads");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ score: 8.2, verdict: "Strong overall fit.", resume_match_status: "READY" })
    );
    expect(updateEqMock).toHaveBeenCalledWith("id", "lead-1");
    expect(result.status).toBe("unlocked");
    if (result.status === "unlocked") {
      expect(result.report.summary).toBe("Strong overall fit.");
    }
  });

  it("returns pending when the re-fetch is still not ready", async () => {
    getResumeMatchReportMock.mockResolvedValue({ status: "PENDING" });
    const { completeReportUnlock } = await import("../completeReportUnlock");

    const result = await completeReportUnlock("user-1", {
      id: "lead-1",
      role_title: "Senior Product Manager",
      ib_applied_job_id: "APJ_1",
      resume_match_status: "PENDING",
      resume_match_raw: null,
    });

    expect(result).toEqual({ status: "pending" });
  });

  it("returns an error result when saving the fetched report fails", async () => {
    getResumeMatchReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 82,
      rank: 1,
      categories: [],
      summary: "Strong overall fit.",
      strongPoints: [],
      weakPoints: [],
    });
    updateEqMock.mockResolvedValue({ error: { message: "db error" } });
    const { completeReportUnlock } = await import("../completeReportUnlock");

    const result = await completeReportUnlock("user-1", {
      id: "lead-1",
      role_title: "Senior Product Manager",
      ib_applied_job_id: "APJ_1",
      resume_match_status: "PENDING",
      resume_match_raw: null,
    });

    expect(result).toEqual({ status: "error", message: "Unlocked, but the report failed to save. Please refresh." });
  });

  it("also unlocks personality and references for a bundle completion", async () => {
    const { completeReportUnlock } = await import("../completeReportUnlock");

    await completeReportUnlock(
      "user-1",
      { id: "lead-1", role_title: "Senior Product Manager", ib_applied_job_id: "APJ_1", resume_match_status: "READY", resume_match_raw: { overallScore: 80 } },
      "bundle"
    );

    expect(unlockProductMock).toHaveBeenCalledWith("user-1", "personality");
    expect(unlockProductMock).toHaveBeenCalledWith("user-1", "references");
  });
});
