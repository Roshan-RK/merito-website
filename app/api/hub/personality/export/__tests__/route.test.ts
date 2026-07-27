import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();

const leadMaybeSingleMock = vi.fn();
const leadLimitMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEqMock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEqMock });

const testMaybeSingleMock = vi.fn();
const testEq2Mock = vi.fn().mockReturnValue({ maybeSingle: testMaybeSingleMock });
const testEq1Mock = vi.fn().mockReturnValue({ eq: testEq2Mock });
const testSelectMock = vi.fn().mockReturnValue({ eq: testEq1Mock });

const fromMock = vi.fn((table: string) => {
  if (table === "fitment_leads") return { select: leadSelectMock };
  if (table === "personality_tests") return { select: testSelectMock };
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

function buildRequest(url = "http://localhost/api/hub/personality/export") {
  return new Request(url);
}

describe("GET /api/hub/personality/export", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    leadMaybeSingleMock.mockReset();
    testMaybeSingleMock.mockReset();
    renderPageToPdfMock.mockReset();
    renderPageToPdfMock.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
  });

  it("returns 404 when no role can be resolved", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });

  it("returns 404 when the personality test hasn't been taken", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadMaybeSingleMock.mockResolvedValue({ data: { role_title: "Senior Product Manager" }, error: null });
    testMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });

  it("returns a PDF when the test has been completed", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadMaybeSingleMock.mockResolvedValue({ data: { role_title: "Senior Product Manager" }, error: null });
    const scores = {
      E: { raw: 30, pct: 50, band: 2 },
      A: { raw: 30, pct: 50, band: 2 },
      C: { raw: 30, pct: 50, band: 2 },
      ES: { raw: 30, pct: 50, band: 2 },
      O: { raw: 30, pct: 50, band: 2 },
    };
    const validity = { meanRaw: 3, pctMid: 10, incon: 0.5, sd: 2 };
    testMaybeSingleMock.mockResolvedValue({ data: { scores, validity }, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("uses the role query param instead of the latest lead when provided", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    const scores = {
      E: { raw: 30, pct: 50, band: 2 },
      A: { raw: 30, pct: 50, band: 2 },
      C: { raw: 30, pct: 50, band: 2 },
      ES: { raw: 30, pct: 50, band: 2 },
      O: { raw: 30, pct: 50, band: 2 },
    };
    const validity = { meanRaw: 3, pctMid: 10, incon: 0.5, sd: 2 };
    testMaybeSingleMock.mockResolvedValue({ data: { scores, validity }, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest("http://localhost/api/hub/personality/export?role=Backend%20Engineer"));

    expect(response.status).toBe(200);
    expect(leadMaybeSingleMock).not.toHaveBeenCalled();
    expect(testEq2Mock).toHaveBeenCalledWith("role_title", "Backend Engineer");
  });
});
