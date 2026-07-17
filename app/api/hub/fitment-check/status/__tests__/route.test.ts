import { describe, it, expect, vi, beforeEach } from "vitest";

const getResumeMatchReportMock = vi.fn();
vi.mock("@/lib/intervuebox/reports", () => ({
  getResumeMatchReport: getResumeMatchReportMock,
  scoreOutOfTen: (overallScore: number) => Math.round(overallScore * 10) / 100,
}));

const maybeSingleMock = vi.fn();
const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
const fromMock = vi.fn().mockReturnValue({ select: selectMock, update: updateMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importRoute() {
  return await import("../route");
}

describe("GET /api/hub/fitment-check/status", () => {
  beforeEach(() => {
    getResumeMatchReportMock.mockReset();
    maybeSingleMock.mockReset();
    updateEqMock.mockClear();
    updateEqMock.mockResolvedValue({ error: null });
    vi.resetModules();
  });

  it("returns 400 when leadId is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/fitment-check/status"));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the lead doesn't exist", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/fitment-check/status?leadId=lead-1"));
    expect(response.status).toBe(404);
  });

  it("rejects requests once the per-IP rate limit is exceeded", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { ib_applied_job_id: "APJ_1", resume_match_status: "READY", score: 7.8, verdict: "Good fit." },
      error: null,
    });
    const { GET } = await importRoute();
    const headers = { "x-forwarded-for": "203.0.113.9" };

    let lastResponse: Response | undefined;
    for (let i = 0; i < 61; i++) {
      const request = new Request("http://localhost/api/hub/fitment-check/status?leadId=lead-1", {
        headers,
      });
      lastResponse = await GET(request);
    }

    expect(lastResponse?.status).toBe(429);
  });

  it("returns the stored score directly when the lead is already READY", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { ib_applied_job_id: "APJ_1", resume_match_status: "READY", score: 7.8, verdict: "Good fit." },
      error: null,
    });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/fitment-check/status?leadId=lead-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", score: 7.8, verdict: "Good fit." });
    expect(getResumeMatchReportMock).not.toHaveBeenCalled();
  });

  it("re-fetches and returns pending when still not ready", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", score: 0, verdict: "" },
      error: null,
    });
    getResumeMatchReportMock.mockResolvedValue({ status: "PENDING" });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/fitment-check/status?leadId=lead-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "pending" });
  });

  it("re-fetches, updates the row, and returns ready once resolved", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", score: 0, verdict: "" },
      error: null,
    });
    getResumeMatchReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 78,
      rank: 2,
      categories: [],
      summary: "Good fit.",
      strongPoints: [],
      weakPoints: [],
    });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/fitment-check/status?leadId=lead-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", score: 7.8, verdict: "Good fit." });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ score: 7.8, verdict: "Good fit.", resume_match_status: "READY" })
    );
    expect(updateEqMock).toHaveBeenCalledWith("id", "lead-1");
  });
});
