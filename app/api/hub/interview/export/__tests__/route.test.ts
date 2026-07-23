import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();

const interviewMaybeSingleMock = vi.fn();
const interviewLimitMock = vi.fn().mockReturnValue({ maybeSingle: interviewMaybeSingleMock });
const interviewOrderMock = vi.fn().mockReturnValue({ limit: interviewLimitMock });
const interviewEqMock = vi.fn();
interviewEqMock.mockReturnValue({ eq: interviewEqMock, order: interviewOrderMock });
const interviewSelectMock = vi.fn().mockReturnValue({ eq: interviewEqMock });

const leadMaybeSingleMock = vi.fn();
const leadLimitMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEq2Mock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadEq1Mock = vi.fn().mockReturnValue({ eq: leadEq2Mock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEq1Mock });

const fromMock = vi.fn((table: string) => {
  if (table === "fitment_interviews") return { select: interviewSelectMock };
  if (table === "fitment_leads") return { select: leadSelectMock };
  throw new Error(`Unexpected table ${table}`);
});

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

const getCandidateResumeDetailsMock = vi.fn();
vi.mock("@/lib/intervuebox/reports", async () => {
  const actual = await vi.importActual("@/lib/intervuebox/reports");
  return { ...actual, getCandidateResumeDetails: getCandidateResumeDetailsMock };
});

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
    leadMaybeSingleMock.mockReset();
    getCandidateResumeDetailsMock.mockReset();
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
      data: { role_title: "HR Business Partner", status: "invited", report_raw: null, updated_at: "2026-07-23T06:00:00Z" },
      error: null,
    });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(404);
  });

  it("returns a PDF when the interview report is ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    interviewMaybeSingleMock.mockResolvedValue({
      data: {
        role_title: "HR Business Partner",
        status: "ready",
        updated_at: "2026-07-23T06:54:26.588Z",
        report_raw: {
          overallScore: 8,
          skillMetrics: { relevance: 9, confidence: 10 },
          overallSummary: "Solid overall.",
          strengths: "- Listens well",
          areasOfImprovement: "- Needs more examples",
          shareableReportLink: "https://hogsmeade.intervuebox.ai/interview-report/abc",
          approxDurationMinutes: 4,
        },
      },
      error: null,
    });
    leadMaybeSingleMock.mockResolvedValue({ data: { name: "Roshan", ib_applied_job_id: "AJ_1" }, error: null });
    const { GET } = await importRoute();

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
