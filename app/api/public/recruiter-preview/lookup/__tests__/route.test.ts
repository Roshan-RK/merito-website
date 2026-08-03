import { describe, it, expect, vi, beforeEach } from "vitest";

function makeQueryStub(result: { data: unknown }) {
  const stub: Record<string, unknown> = {};
  stub.select = () => stub;
  stub.eq = () => stub;
  stub.order = () => stub;
  stub.limit = () => stub;
  stub.maybeSingle = async () => result;
  stub.then = (resolve: (value: typeof result) => void) => resolve(result);
  return stub;
}

let tableResults: Record<string, ReturnType<typeof makeQueryStub>>;
const fromMock = vi.fn((table: string) => tableResults[table]);
const getUserByIdMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: fromMock,
    auth: { admin: { getUserById: getUserByIdMock } },
  }),
}));

const getReferenceCheckStatusMock = vi.fn();
vi.mock("@/lib/referenceChecks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/referenceChecks")>();
  return { ...actual, getReferenceCheckStatus: getReferenceCheckStatusMock };
});

async function importRoute() {
  return await import("../route");
}

function request(body: unknown, key = "test-key") {
  return new Request("http://localhost/api/public/recruiter-preview/lookup", {
    method: "POST",
    headers: key ? { "x-merito-extension-key": key } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/recruiter-preview/lookup", () => {
  beforeEach(() => {
    vi.stubEnv("RECRUITER_EXTENSION_KEY", "test-key");
    tableResults = {
      recruiter_preview_settings: makeQueryStub({ data: null }),
      fitment_leads: makeQueryStub({ data: [] }),
      personality_tests: makeQueryStub({ data: null }),
      fitment_interviews: makeQueryStub({ data: null }),
    };
    fromMock.mockClear();
    getUserByIdMock.mockReset();
    getUserByIdMock.mockResolvedValue({ data: { user: { email: "jane@example.com" } } });
    getReferenceCheckStatusMock.mockReset();
    getReferenceCheckStatusMock.mockResolvedValue(null);
  });

  it("returns 401 when the key header is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }, ""));
    expect(response.status).toBe(401);
  });

  it("returns 401 when the key header is wrong", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }, "wrong-key"));
    expect(response.status).toBe(401);
  });

  it("returns 404 on a malformed linkedinUrl", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "not-a-url" }));
    expect(response.status).toBe(404);
  });

  it("returns 404 when no candidate matches", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/nobody" }));
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Not found." });
  });

  it("returns the identical 404 body when a candidate matches but is disabled", async () => {
    // The settings query itself already filters on enabled=true, so a disabled
    // candidate simply produces no row — same as "no candidate" from the route's
    // point of view. This test locks that behavior in.
    tableResults.recruiter_preview_settings = makeQueryStub({ data: null });
    const { POST } = await importRoute();
    const noMatchResponse = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/disabled-candidate" }));
    const disabledBody = await noMatchResponse.json();
    const noMatchBody = { error: "Not found." };
    expect(noMatchResponse.status).toBe(404);
    expect(disabledBody).toEqual(noMatchBody);
  });

  it("returns filtered data on a match, excluding unselected sections and always excluding recommendation/integrity/videoReport", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({
      data: { user_id: "candidate-1", sections: ["fitment", "interview", "personality"] },
    });
    tableResults.fitment_leads = makeQueryStub({
      data: [
        {
          role_title: "Data Analyst",
          name: "Jane Doe",
          resume_match_status: "READY",
          resume_match_raw: { overallScore: 82, rank: null, categories: [], summary: "Good fit", strongPoints: [], weakPoints: [] },
        },
      ],
    });
    tableResults.personality_tests = makeQueryStub({
      data: { scores: { O: { pct: 70, raw: 44, band: 3 } }, completed_at: "2026-07-28T09:00:00.000Z" },
    });
    tableResults.fitment_interviews = makeQueryStub({
      data: {
        status: "ready",
        updated_at: "2026-07-30T10:00:00.000Z",
        report_raw: {
          overallScore: 75,
          skillMetrics: { sql: 8 },
          overallSummary: "Solid performance.",
          strengths: "Strong SQL fundamentals",
          areasOfImprovement: "Communication",
          shareableReportLink: null,
          approxDurationMinutes: 20,
          flagForSuspiciousActivity: false,
          integrityCheck: "No issues.",
          videoReport: "Some private delivery notes.",
          feedbackToInterviewer: "Do not hire.",
          roadmap: "Practice window functions.",
          criteriaEvaluationTable: [],
          interviewTitle: "Data Analyst Interview",
          skillReport: { sql: { score: 8, comment: "Strong" } },
          overallSkillScore: 80,
          answers: [],
          knowledgeAnswers: [],
        },
      },
    });

    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.candidateName).toBe("Jane Doe");
    expect(body.roleTitle).toBe("Data Analyst");
    expect(body.sections).toEqual(["fitment", "interview", "personality"]);
    expect(body.fitment).toEqual({
      report: { overallScore: 82, rank: null, categories: [], summary: "Good fit", strongPoints: [], weakPoints: [] },
      matchedAgainstRoleTitle: "Data Analyst",
    });
    expect(body.personality).toEqual({
      scores: { O: { pct: 70, raw: 44, band: 3 } },
      completedAt: "2026-07-28T09:00:00.000Z",
    });
    expect(body.references).toBeNull();
    expect(body.interview).toEqual({
      overallScore: 75,
      skillMetrics: { sql: 8 },
      overallSummary: "Solid performance.",
      skillReport: { sql: { score: 8, comment: "Strong" } },
      criteriaEvaluationTable: [],
      strengths: "Strong SQL fundamentals",
      roadmap: "Practice window functions.",
      completedAt: "2026-07-30T10:00:00.000Z",
      approxDurationMinutes: 20,
    });
    expect(body.interview).not.toHaveProperty("integrityCheck");
    expect(body.interview).not.toHaveProperty("videoReport");
    expect(body.interview).not.toHaveProperty("feedbackToInterviewer");
  });
});
