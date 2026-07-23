import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();

// fitment_leads (used by both the fitment section and the interview section's
// candidate-name/org lookup)
const leadMaybeSingleMock = vi.fn();
const leadLimitMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEq2Mock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadEq1Mock = vi.fn().mockReturnValue({ eq: leadEq2Mock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEq1Mock });

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
const interviewEqMock = vi.fn();
interviewEqMock.mockReturnValue({ eq: interviewEqMock, order: interviewOrderMock });
const interviewSelectMock = vi.fn().mockReturnValue({ eq: interviewEqMock });

const isReportUnlockedMock = vi.fn();
vi.mock("@/lib/reportUnlocks", () => ({ isReportUnlocked: isReportUnlockedMock }));

const getCandidateResumeDetailsMock = vi.fn();
vi.mock("@/lib/intervuebox/reports", async () => {
  const actual = await vi.importActual("@/lib/intervuebox/reports");
  return { ...actual, getCandidateResumeDetails: getCandidateResumeDetailsMock };
});

let leadSelectCallCount = 0;
const fromMock = vi.fn((table: string) => {
  if (table === "fitment_leads") {
    leadSelectCallCount += 1;
    // First call in the route is always the "list all leads for fitment
    // section" shape (select().eq().order().limit()); later calls (used to
    // resolve interview candidate name/org) use select().eq().eq().order().limit().
    return leadSelectCallCount === 1 ? { select: leadListSelectMock } : { select: leadSelectMock };
  }
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
  beforeEach(() => {
    getUserMock.mockReset();
    leadMaybeSingleMock.mockReset();
    leadListLimitMock.mockReset();
    personalityMaybeSingleMock.mockReset();
    interviewMaybeSingleMock.mockReset();
    isReportUnlockedMock.mockReset();
    getCandidateResumeDetailsMock.mockReset();
    leadSelectCallCount = 0;
    getCandidateResumeDetailsMock.mockResolvedValue({
      skills: [],
      education: [],
      experience: [],
      certifications: [],
      phoneNumber: null,
      location: null,
      totalExperience: null,
    });
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
      data: [
        {
          role_title: "Senior Product Manager",
          name: "Roshan",
          score: 9.2,
          resume_match_status: "READY",
          resume_match_raw: { overallScore: 92, rank: 1, categories: [], summary: "Great fit.", strongPoints: [], weakPoints: [] },
          ib_applied_job_id: "AJ_1",
        },
      ],
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
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("returns a combined PDF when all three requested types are ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    leadListLimitMock.mockResolvedValue({
      data: [
        {
          role_title: "Senior Product Manager",
          name: "Roshan",
          score: 9.2,
          resume_match_status: "READY",
          resume_match_raw: { overallScore: 92, rank: 1, categories: [], summary: "Great fit.", strongPoints: [], weakPoints: [] },
          ib_applied_job_id: "AJ_1",
        },
      ],
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
      data: {
        role_title: "Senior Product Manager",
        status: "ready",
        updated_at: "2026-07-23T06:54:26.588Z",
        report_raw: {
          overallScore: 8,
          skillMetrics: { relevance: 9 },
          overallSummary: "Solid.",
          strengths: "- Good",
          areasOfImprovement: "- More detail",
          shareableReportLink: null,
          approxDurationMinutes: 4,
        },
      },
      error: null,
    });
    leadMaybeSingleMock.mockResolvedValue({ data: { name: "Roshan", ib_applied_job_id: "AJ_1" }, error: null });
    const { GET } = await importRoute();

    const response = await GET(
      buildRequest("http://localhost/api/hub/export/combined?include=fitment,personality,interview&role=Senior%20Product%20Manager")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
