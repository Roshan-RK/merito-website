import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();
const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
const eqRoleMock = vi.fn().mockReturnValue({ order: orderMock });
const eqUserMock = vi.fn().mockReturnValue({ eq: eqRoleMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock });
const fromMock = vi.fn().mockReturnValue({ select: selectMock });

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
const adminFromMock = vi.fn().mockReturnValue({ update: updateMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: adminFromMock }),
}));

const getInterviewReportMock = vi.fn();
const generateInterviewReportMock = vi.fn();
vi.mock("@/lib/intervuebox/interviewReports", () => ({
  getInterviewReport: getInterviewReportMock,
  generateInterviewReport: generateInterviewReportMock,
}));

async function importRoute() {
  return await import("../route");
}

function requestFor(role: string) {
  return new Request(`http://localhost/api/hub/interview/status?role=${encodeURIComponent(role)}`);
}

describe("GET /api/hub/interview/status", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    maybeSingleMock.mockReset();
    updateEqMock.mockClear();
    updateEqMock.mockResolvedValue({ error: null });
    updateMock.mockClear();
    getInterviewReportMock.mockReset();
    generateInterviewReportMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when role is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/interview/status"));
    expect(response.status).toBe(400);
  });

  it("returns not_started when there is no row", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: null });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    const body = await response.json();
    expect(body).toEqual({ status: "not_started" });
    expect(getInterviewReportMock).not.toHaveBeenCalled();
  });

  it("returns ready straight from the row without re-checking IntervueBox", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: { id: "row-1", status: "ready" } });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    const body = await response.json();
    expect(body).toEqual({ status: "ready" });
    expect(getInterviewReportMock).not.toHaveBeenCalled();
  });

  it("still processing on IntervueBox's side -- stays invited and doesn't write", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "IV-1", ib_candidate_id: "USR-1" },
    });
    getInterviewReportMock.mockResolvedValue({ status: "NOT_READY" });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    const body = await response.json();
    expect(body).toEqual({ status: "invited" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("self-heals: a missed webhook doesn't matter if IntervueBox already has the report ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "IV-1", ib_candidate_id: "USR-1" },
    });
    getInterviewReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 82,
      skillMetrics: {},
      overallSummary: "Strong candidate.",
      strengths: null,
      areasOfImprovement: null,
      shareableReportLink: null,
      approxDurationMinutes: null,
      flagForSuspiciousActivity: false,
      integrityCheck: null,
      videoReport: null,
      feedbackToInterviewer: null,
      roadmap: null,
      criteriaEvaluationTable: [],
      interviewTitle: null,
      skillReport: {},
      overallSkillScore: null,
      answers: [],
      knowledgeAnswers: [],
    });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    const body = await response.json();
    expect(body).toEqual({ status: "ready" });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "ready" }));
    expect(updateEqMock).toHaveBeenCalledWith("id", "row-1");
  });

  it("returns stuck status when stuck_at is set and self-heal doesn't find a ready report", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "IV-1", ib_candidate_id: "USR-1", stuck_at: "2026-08-19T10:00:00.000Z" },
    });
    getInterviewReportMock.mockResolvedValue({ status: "NOT_READY" });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    const body = await response.json();
    expect(body).toEqual({ status: "stuck" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("self-heal still wins over stuck_at when the report actually arrived", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "IV-1", ib_candidate_id: "USR-1", stuck_at: "2026-08-19T10:00:00.000Z" },
    });
    getInterviewReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 82,
      skillMetrics: {},
      overallSummary: "Strong candidate.",
      strengths: null,
      areasOfImprovement: null,
      shareableReportLink: null,
      approxDurationMinutes: null,
      flagForSuspiciousActivity: false,
      integrityCheck: null,
      videoReport: null,
      feedbackToInterviewer: null,
      roadmap: null,
      criteriaEvaluationTable: [],
      interviewTitle: null,
      skillReport: {},
      overallSkillScore: null,
      answers: [],
      knowledgeAnswers: [],
    });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    const body = await response.json();
    expect(body).toEqual({ status: "ready" });
  });

  it("returns terminated status without calling generateInterviewReport", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "terminated", ib_agent_id: "IV-1", ib_candidate_id: "USR-1", report_generation_requested_at: null },
    });
    getInterviewReportMock.mockResolvedValue({ status: "NOT_READY" });

    const { GET } = await importRoute();
    const response = await GET(requestFor("Backend Engineer"));

    expect(await response.json()).toEqual({ status: "terminated" });
    expect(generateInterviewReportMock).not.toHaveBeenCalled();
  });

  it("IntervueBox check itself fails -- doesn't blow up, just stays invited", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "IV-1", ib_candidate_id: "USR-1" },
    });
    getInterviewReportMock.mockRejectedValue(new Error("boom"));
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    const body = await response.json();
    expect(body).toEqual({ status: "invited" });
  });
});
