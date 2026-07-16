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
const generateFitmentReportMock = vi.fn();

const reportUpsertMock = vi.fn();
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
vi.mock("@/lib/generateFitmentReport", () => ({
  generateFitmentReport: generateFitmentReportMock,
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
    generateFitmentReportMock.mockReset();
    reportUpsertMock.mockReset();
    adminFromMock.mockReset();
    adminFromMock.mockReturnValue({ upsert: reportUpsertMock });
    reportUpsertMock.mockResolvedValue({ error: null });
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

  it("unlocks and generates the report when CV text is on file", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({
      data: { jd_text: "JD text", cv_text: "CV text", score: 7.8 },
      error: null,
    });
    unlockReportMock.mockResolvedValue(undefined);
    generateFitmentReportMock.mockResolvedValue({
      strengths: ["a"],
      gaps: ["b"],
      cvFixes: ["c"],
    });

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(unlockReportMock).toHaveBeenCalledWith("user-123", "Senior Product Manager");
    expect(generateFitmentReportMock).toHaveBeenCalledWith("JD text", "CV text", 7.8);
    expect(adminFromMock).toHaveBeenCalledWith("fitment_reports");
    expect(reportUpsertMock).toHaveBeenCalledWith(
      {
        user_id: "user-123",
        role_title: "Senior Product Manager",
        strengths: ["a"],
        gaps: ["b"],
        cv_fixes: ["c"],
      },
      { onConflict: "user_id,role_title" }
    );
    expect(body).toEqual({ status: "unlocked", report: { strengths: ["a"], gaps: ["b"], cvFixes: ["c"] } });
  });

  it("unlocks but returns needs_cv when there is no CV text on file", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({
      data: { jd_text: "JD text", cv_text: null, score: 7.8 },
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
    expect(generateFitmentReportMock).not.toHaveBeenCalled();
    expect(body).toEqual({ status: "needs_cv" });
  });
});
