import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const generateInterviewReportMock = vi.fn();
vi.mock("@/lib/intervuebox/interviewReports", () => ({ generateInterviewReport: generateInterviewReportMock }));

const maybeSingleMock = vi.fn();
const eqSelectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqSelectMock });

const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

const fromMock = vi.fn().mockReturnValue({ select: selectMock, update: updateMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

const logAdminActionMock = vi.fn();
vi.mock("@/lib/adminAuditLog", () => ({ logAdminAction: logAdminActionMock }));

function buildRequest() {
  return new Request("http://localhost/api/admin/interviews/row-1/generate", { method: "POST" });
}

describe("POST /api/admin/interviews/[id]/generate", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "admin@merito.in" });
    generateInterviewReportMock.mockReset();
    generateInterviewReportMock.mockResolvedValue(undefined);
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: { id: "row-1", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" }, error: null });
    updateMock.mockClear();
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("requests generation and logs the admin action", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest(), { params: Promise.resolve({ id: "row-1" }) });

    expect(response.status).toBe(200);
    expect(generateInterviewReportMock).toHaveBeenCalledWith("INT_1", ["USR_1"]);
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "interview.generate", targetType: "interview", targetId: "row-1" })
    );
  });

  it("returns 404 when the row doesn't exist", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("../route");

    const response = await POST(buildRequest(), { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
    expect(generateInterviewReportMock).not.toHaveBeenCalled();
  });

  it("returns 502 when the vendor call throws", async () => {
    generateInterviewReportMock.mockRejectedValue(new Error("IntervueBox 500"));
    const { POST } = await import("../route");

    const response = await POST(buildRequest(), { params: Promise.resolve({ id: "row-1" }) });

    expect(response.status).toBe(502);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("still returns ok when logging the admin action fails", async () => {
    logAdminActionMock.mockRejectedValue(new Error("db down"));
    const { POST } = await import("../route");

    const response = await POST(buildRequest(), { params: Promise.resolve({ id: "row-1" }) });

    expect(response.status).toBe(200);
  });
});
