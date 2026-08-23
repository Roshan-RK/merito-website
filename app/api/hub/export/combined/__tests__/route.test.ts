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
const interviewEqMock = vi.fn();
interviewEqMock.mockReturnValue({ eq: interviewEqMock, or: interviewOrMock, order: interviewOrderMock });
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

describe("GET /api/hub/export/combined", () => {
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
      buildRequest("http://localhost/api/hub/export/combined?include=fitment&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when none of the requested types have data", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({ data: [], error: null });
    personalityMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    interviewMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=fitment,personality,interview&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(404);
  });

  it("returns a PDF containing only the ready sections when one requested type isn't actually ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({
      data: [{ id: "lead-1", role_title: "Senior Product Manager", resume_match_status: "READY", resume_match_raw: { overallScore: 92 } }],
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(true);
    // interview requested but not ready -> should be silently omitted, not error the whole request
    interviewMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=fitment,interview&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(renderPageToPdfMock).toHaveBeenCalledTimes(1);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("returns a combined PDF merging fitment, personality, interview, and references when all four are ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({
      data: [{ id: "lead-1", role_title: "Senior Product Manager", resume_match_status: "READY", resume_match_raw: { overallScore: 92 } }],
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(true);
    const scores = {
      E: { raw: 30, pct: 50, band: 2 },
      A: { raw: 30, pct: 50, band: 2 },
      C: { raw: 30, pct: 50, band: 2 },
      ES: { raw: 30, pct: 50, band: 2 },
      O: { raw: 30, pct: 50, band: 2 },
    };
    const validity = { meanRaw: 3, pctMid: 10, incon: 0.5, sd: 2 };
    personalityMaybeSingleMock.mockResolvedValue({ data: { scores, validity }, error: null });
    interviewMaybeSingleMock.mockResolvedValue({
      data: { role_title: "Senior Product Manager", status: "ready", report_raw: { overallScore: 8 } },
      error: null,
    });
    getReferenceCheckStatusMock.mockResolvedValue({ checkId: "chk-1", status: "completed", minReferences: 3, referees: [] });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest(
        "http://localhost/api/hub/export/combined?include=fitment,personality,interview,references&role=Senior%20Product%20Manager"
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(renderPageToPdfMock).toHaveBeenCalledTimes(1);
    expect(renderPageToPdfMock).toHaveBeenCalledWith(
      "http://localhost/hub/account/combined-report/print?include=fitment%2Cpersonality%2Cinterview%2Creferences&role=Senior+Product+Manager",
      [],
      { singlePage: true }
    );
    expect(interviewOrMock).toHaveBeenCalledWith('lead_id.eq.lead-1,role_title.eq."Senior Product Manager"');
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("passes the fetched lead id to the fitment_interviews identity match when interview is requested without fitment", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({
      data: [{ id: "lead-1", role_title: "Senior Product Manager", resume_match_status: "READY", resume_match_raw: { overallScore: 92 } }],
      error: null,
    });
    interviewMaybeSingleMock.mockResolvedValue({
      data: { role_title: "Senior Product Manager", status: "ready", report_raw: { overallScore: 8 } },
      error: null,
    });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=interview&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(200);
    // This is the case Task 4 fixed: fetching the lead is gated on
    // include.has("fitment") || include.has("interview"), not just
    // "fitment" alone -- if that gate regressed to "fitment"-only, `current`
    // would be null here, the query would fall back to a bare role_title
    // match, and interviewOrMock would never be called at all.
    expect(interviewOrMock).toHaveBeenCalledWith('lead_id.eq.lead-1,role_title.eq."Senior Product Manager"');
  });

  it("falls back to a plain role_title match, never OR-ing in the latest lead's id, when the requested role differs from the latest lead's role_title", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    // The latest lead is for a DIFFERENT role than the one requested -- this
    // is the Finding 3 scenario: a share link frozen at an older role while
    // the candidate has since fitment-checked a newer one. OR-ing the
    // latest lead's id together with the requested roleTitle would match
    // two different leads' identities and could surface the wrong lead's
    // interview via .order("updated_at").limit(1).
    leadListLimitMock.mockResolvedValue({
      data: [{ id: "lead-1", role_title: "Senior Product Manager", resume_match_status: "READY", resume_match_raw: { overallScore: 92 } }],
      error: null,
    });
    interviewMaybeSingleMock.mockResolvedValue({
      data: { role_title: "Growth Marketer", status: "ready", report_raw: { overallScore: 8 } },
      error: null,
    });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=interview&role=Growth%20Marketer")
    );

    expect(response.status).toBe(200);
    expect(interviewOrMock).not.toHaveBeenCalled();
    expect(interviewEqMock).toHaveBeenCalledWith("role_title", "Growth Marketer");
  });

  it("sets an inline Content-Disposition when inline=1 is passed, for the preview modal's iframe", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({
      data: [{ id: "lead-1", role_title: "Senior Product Manager", resume_match_status: "READY", resume_match_raw: { overallScore: 92 } }],
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(true);
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=fitment&role=Senior%20Product%20Manager&inline=1")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('inline; filename="merito-report.pdf"');
  });

  it("defaults to an attachment Content-Disposition when inline isn't passed", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({
      data: [{ id: "lead-1", role_title: "Senior Product Manager", resume_match_status: "READY", resume_match_raw: { overallScore: 92 } }],
      error: null,
    });
    isReportUnlockedMock.mockResolvedValue(true);
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=fitment&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="merito-report.pdf"');
  });
});
