import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();

const leadListLimitMock = vi.fn();
const leadListOrderMock = vi.fn().mockReturnValue({ limit: leadListLimitMock });
const leadListEqMock = vi.fn().mockReturnValue({ order: leadListOrderMock });
const leadListSelectMock = vi.fn().mockReturnValue({ eq: leadListEqMock });

const personalityMaybeSingleMock = vi.fn();
const personalityEq2Mock = vi.fn().mockReturnValue({ maybeSingle: personalityMaybeSingleMock });
const personalityEq1Mock = vi.fn().mockReturnValue({ eq: personalityEq2Mock });
const personalitySelectMock = vi.fn().mockReturnValue({ eq: personalityEq1Mock });

const interviewMaybeSingleMock = vi.fn();
const interviewLimitMock = vi.fn().mockReturnValue({ maybeSingle: interviewMaybeSingleMock });
const interviewOrderMock = vi.fn().mockReturnValue({ limit: interviewLimitMock });
const interviewOrMock = vi.fn().mockReturnValue({ order: interviewOrderMock });
const interviewEqMock = vi.fn().mockReturnValue({ or: interviewOrMock, order: interviewOrderMock });
const interviewSelectMock = vi.fn().mockReturnValue({ eq: interviewEqMock });

const isReportUnlockedMock = vi.fn();
vi.mock("@/lib/reportUnlocks", () => ({ isReportUnlocked: isReportUnlockedMock }));

const getReferenceCheckStatusMock = vi.fn();
vi.mock("@/lib/referenceChecks", () => ({ getReferenceCheckStatus: getReferenceCheckStatusMock }));

const renderPageToPdfMock = vi.fn();
vi.mock("@/lib/pdf/renderPageToPdf", () => ({
  renderPageToPdf: renderPageToPdfMock,
  requestCookiesFor: () => [],
}));

const fromMock = vi.fn((table: string) => {
  if (table === "fitment_leads") return { select: leadListSelectMock };
  if (table === "personality_tests") return { select: personalitySelectMock };
  if (table === "fitment_interviews") return { select: interviewSelectMock };
  throw new Error(`Unexpected table ${table}`);
});

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

async function importRoute() {
  return await import("../route");
}

function buildRequest(url: string) {
  return new Request(url);
}

describe("GET /api/hub/export/share-summary", () => {
  beforeEach(async () => {
    getUserMock.mockReset();
    leadListLimitMock.mockReset();
    personalityMaybeSingleMock.mockReset();
    interviewMaybeSingleMock.mockReset();
    interviewOrMock.mockClear();
    isReportUnlockedMock.mockReset();
    getReferenceCheckStatusMock.mockReset();
    renderPageToPdfMock.mockReset();
    renderPageToPdfMock.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/share-summary?include=fitment&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when none of the requested sections are ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({ data: [], error: null });
    personalityMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    interviewMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/share-summary?include=fitment,personality,interview&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(404);
  });

  it("returns a PDF when at least one requested section is ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({
      data: [{ id: "lead-1", role_title: "Senior Product Manager", resume_match_status: "READY" }],
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(true);
    interviewMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/share-summary?include=fitment,interview&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(interviewOrMock).toHaveBeenCalledWith('lead_id.eq.lead-1,role_title.eq."Senior Product Manager"');
    expect(renderPageToPdfMock).toHaveBeenCalledTimes(1);
    expect(renderPageToPdfMock).toHaveBeenCalledWith(
      "http://localhost/hub/account/share-summary?include=fitment%2Cinterview",
      []
    );
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("quotes a comma-bearing role_title so it can't split the .or() filter into an extra clause", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({
      data: [{ id: "lead-1", role_title: "Manager, Growth", resume_match_status: "READY" }],
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(true);
    interviewMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    await GET(buildRequest("http://localhost/api/hub/export/share-summary?include=fitment,interview"));

    expect(interviewOrMock).toHaveBeenCalledWith('lead_id.eq.lead-1,role_title.eq."Manager, Growth"');
  });
});
