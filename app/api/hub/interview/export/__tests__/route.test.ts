import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();

const interviewMaybeSingleMock = vi.fn();
const interviewLimitMock = vi.fn().mockReturnValue({ maybeSingle: interviewMaybeSingleMock });
const interviewOrderMock = vi.fn().mockReturnValue({ limit: interviewLimitMock });
const interviewEqMock = vi.fn();
interviewEqMock.mockReturnValue({ eq: interviewEqMock, order: interviewOrderMock });
const interviewSelectMock = vi.fn().mockReturnValue({ eq: interviewEqMock });

const fromMock = vi.fn((table: string) => {
  if (table === "fitment_interviews") return { select: interviewSelectMock };
  throw new Error(`Unexpected table ${table}`);
});

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

const renderPageToPdfMock = vi.fn();
vi.mock("@/lib/pdf/renderPageToPdf", () => ({
  renderPageToPdf: renderPageToPdfMock,
  requestCookiesFor: () => [],
}));

async function importRoute() {
  return await import("../route");
}

function buildRequest(url = "http://localhost/api/hub/interview/export?role=HR%20Business%20Partner") {
  return new Request(url);
}

describe("GET /api/hub/interview/export", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    interviewMaybeSingleMock.mockReset();
    renderPageToPdfMock.mockReset();
    renderPageToPdfMock.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
  });

  it("returns 404 when no interview row exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    interviewMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });

  it("returns 404 when the interview isn't ready yet", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    interviewMaybeSingleMock.mockResolvedValue({
      data: { role_title: "HR Business Partner", status: "invited", report_raw: null },
      error: null,
    });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });

  it("returns a PDF rendered from the live interview page when ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    interviewMaybeSingleMock.mockResolvedValue({
      data: {
        role_title: "HR Business Partner",
        status: "ready",
        report_raw: { overallScore: 8 },
      },
      error: null,
    });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(renderPageToPdfMock).toHaveBeenCalledWith(
      "http://localhost/hub/account/interview/print?role=HR%20Business%20Partner",
      [],
      { singlePage: true }
    );
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
