import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const leadSelectMock = vi.fn();
const leadEq1Mock = vi.fn();
const leadEq2Mock = vi.fn();
const leadOrderMock = vi.fn();
const leadLimitMock = vi.fn();
const leadMaybeSingleMock = vi.fn();
const sessionFromMock = vi.fn();

const unlockReportMock = vi.fn();
const getResumeMatchReportMock = vi.fn();

const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
const adminFromMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: sessionFromMock,
  }),
}));
vi.mock("@/lib/reportUnlocks", () => ({
  unlockReport: unlockReportMock,
  isReportUnlocked: vi.fn(),
}));
vi.mock("@/lib/intervuebox/reports", () => ({
  getResumeMatchReport: getResumeMatchReportMock,
  scoreOutOfTen: (overallScore: number) => Math.round(overallScore * 10) / 100,
}));
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: adminFromMock }),
}));

function buildLeadChain(result: { data: unknown; error: unknown }) {
  sessionFromMock.mockReturnValue({ select: leadSelectMock });
  leadSelectMock.mockReturnValue({ eq: leadEq1Mock });
  leadEq1Mock.mockReturnValue({ eq: leadEq2Mock });
  leadEq2Mock.mockReturnValue({ order: leadOrderMock });
  leadOrderMock.mockReturnValue({ limit: leadLimitMock });
  leadLimitMock.mockReturnValue({ maybeSingle: leadMaybeSingleMock });
  leadMaybeSingleMock.mockResolvedValue(result);
}

async function importRoute() {
  return await import("../route");
}

describe("POST /api/hub/unlock-report", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    sessionFromMock.mockReset();
    leadSelectMock.mockReset();
    leadEq1Mock.mockReset();
    leadEq2Mock.mockReset();
    leadOrderMock.mockReset();
    leadLimitMock.mockReset();
    leadMaybeSingleMock.mockReset();
    unlockReportMock.mockReset();
    getResumeMatchReportMock.mockReset();
    updateMock.mockClear();
    updateEqMock.mockClear();
    updateEqMock.mockResolvedValue({ error: null });
    adminFromMock.mockReset();
    adminFromMock.mockReturnValue({ update: updateMock });
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when roleTitle is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when no fitment_leads row matches the role for this user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({ data: null, error: null });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(unlockReportMock).not.toHaveBeenCalled();
  });

  it("returns the stored resume-match detail directly when already READY", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    const storedRaw = { overallScore: 78, rank: 1, categories: [], summary: "Good fit.", strongPoints: [], weakPoints: [] };
    buildLeadChain({
      data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "READY", resume_match_raw: storedRaw },
      error: null,
    });
    unlockReportMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(unlockReportMock).toHaveBeenCalledWith("user-123", "Senior Product Manager");
    expect(getResumeMatchReportMock).not.toHaveBeenCalled();
    expect(body).toEqual({ status: "unlocked", report: storedRaw });
  });

  it("re-fetches, updates the row, and unlocks when the stored status was still PENDING", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({
      data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", resume_match_raw: null },
      error: null,
    });
    unlockReportMock.mockResolvedValue(undefined);
    getResumeMatchReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 82,
      rank: 1,
      categories: [],
      summary: "Strong overall fit.",
      strongPoints: ["Skill A"],
      weakPoints: ["Gap A"],
    });

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(adminFromMock).toHaveBeenCalledWith("fitment_leads");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ score: 8.2, verdict: "Strong overall fit.", resume_match_status: "READY" })
    );
    expect(updateEqMock).toHaveBeenCalledWith("id", "lead-1");
    expect(body.status).toBe("unlocked");
    expect(body.report.summary).toBe("Strong overall fit.");
  });

  it("returns pending when re-fetch is still not ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({
      data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", resume_match_raw: null },
      error: null,
    });
    unlockReportMock.mockResolvedValue(undefined);
    getResumeMatchReportMock.mockResolvedValue({ status: "PENDING" });

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "pending" });
  });
});
