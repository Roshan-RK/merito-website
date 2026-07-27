import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const leadLimitMock = vi.fn();
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEqMock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEqMock });
const fromMock = vi.fn().mockReturnValue({ select: leadSelectMock });
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

const isReportUnlockedMock = vi.fn();
vi.mock("@/lib/reportUnlocks", () => ({ isReportUnlocked: isReportUnlockedMock }));

const renderPageToPdfMock = vi.fn();
vi.mock("@/lib/pdf/renderPageToPdf", () => ({
  renderPageToPdf: renderPageToPdfMock,
  requestCookiesFor: () => [],
}));

async function importRoute() {
  return await import("../route");
}

describe("GET /api/hub/report/export", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    leadLimitMock.mockReset();
    isReportUnlockedMock.mockReset();
    renderPageToPdfMock.mockReset();
    renderPageToPdfMock.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();

    const response = await GET(new Request("http://localhost/api/hub/report/export"));

    expect(response.status).toBe(401);
    expect(renderPageToPdfMock).not.toHaveBeenCalled();
  });

  it("returns 404 when there is no fitment lead", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadLimitMock.mockResolvedValue({ data: [], error: null });
    const { GET } = await importRoute();

    const response = await GET(new Request("http://localhost/api/hub/report/export"));

    expect(response.status).toBe(404);
    expect(renderPageToPdfMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the report isn't unlocked", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadLimitMock.mockResolvedValue({
      data: [{ role_title: "Senior Product Manager", resume_match_status: "READY", resume_match_raw: { overallScore: 92 } }],
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(false);
    const { GET } = await importRoute();

    const response = await GET(new Request("http://localhost/api/hub/report/export"));

    expect(response.status).toBe(403);
    expect(renderPageToPdfMock).not.toHaveBeenCalled();
  });

  it("returns a PDF rendered from the live report page when unlocked and ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadLimitMock.mockResolvedValue({
      data: [{ role_title: "Senior Product Manager", resume_match_status: "READY", resume_match_raw: { overallScore: 92 } }],
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(true);
    const { GET } = await importRoute();

    const response = await GET(new Request("http://localhost/api/hub/report/export"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(renderPageToPdfMock).toHaveBeenCalledWith("http://localhost/hub/account/report", []);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
