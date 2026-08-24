import { describe, it, expect, vi, beforeEach } from "vitest";

function makeQueryStub(result: { data: unknown }) {
  const stub: Record<string, unknown> = {};
  stub.select = () => stub;
  stub.eq = () => stub;
  stub.order = () => stub;
  stub.limit = () => stub;
  stub.maybeSingle = async () => result;
  stub.then = (resolve: (value: typeof result) => void) => resolve(result);
  stub.insert = async () => ({ error: null });
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
      recruiter_preview_sections: makeQueryStub({ data: null }),
      personality_tests: makeQueryStub({ data: null }),
      fitment_interviews: makeQueryStub({ data: null }),
      intervuebox_interview_reports: makeQueryStub({ data: null }),
      extension_lookups: makeQueryStub({ data: null }),
    };
    fromMock.mockClear();
    getUserByIdMock.mockReset();
    getUserByIdMock.mockResolvedValue({ data: { user: { email: "jane@example.com" } } });
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

  it("returns 404 when no leads exist", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({
      data: { user_id: "candidate-1" },
    });
    tableResults.fitment_leads = makeQueryStub({ data: [] });
    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/nobody" }));
    expect(response.status).toBe(404);
  });

  it("returns array of roles with isCurrent=true on first one", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({
      data: { user_id: "candidate-1" },
    });
    tableResults.fitment_leads = makeQueryStub({
      data: [
        {
          id: "lead-1",
          role_title: "Data Analyst",
          name: "Jane Doe",
          resume_match_status: "READY",
          candidate_level: "mid",
          resume_match_raw: { overallScore: 82, rank: null, categories: [], summary: "Good fit", strongPoints: [], weakPoints: [] },
        },
        {
          id: "lead-2",
          role_title: "Software Engineer",
          name: "Jane Doe",
          resume_match_status: "READY",
          candidate_level: "mid",
          resume_match_raw: { overallScore: 75, rank: null, categories: [], summary: "Ok fit", strongPoints: [], weakPoints: [] },
        },
      ],
    });
    tableResults.recruiter_preview_sections = makeQueryStub({
      data: { sections: ["fitment"] },
    });
    tableResults.personality_tests = makeQueryStub({
      data: {
        scores: {
          E: { pct: 40, raw: 20, band: 2 },
          A: { pct: 55, raw: 30, band: 2 },
          C: { pct: 82, raw: 45, band: 4 },
          ES: { pct: 78, raw: 42, band: 4 },
          O: { pct: 70, raw: 44, band: 3 },
        },
        completed_at: "2026-07-28T09:00:00.000Z",
      },
    });

    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.candidateName).toBe("Jane Doe");
    expect(body.roles).toBeInstanceOf(Array);
    expect(body.roles.length).toBe(2);

    // First role should have isCurrent=true
    expect(body.roles[0]).toMatchObject({
      leadId: "lead-1",
      roleTitle: "Data Analyst",
      isCurrent: true,
      sections: {
        fitment: {
          report: { overallScore: 82, categories: [], summary: "Good fit" },
          matchedAgainstRoleTitle: "Data Analyst",
        },
      },
    });

    // Second role should have isCurrent=false
    expect(body.roles[1]).toMatchObject({
      leadId: "lead-2",
      roleTitle: "Software Engineer",
      isCurrent: false,
      sections: {
        fitment: {
          report: { overallScore: 75, categories: [], summary: "Ok fit" },
          matchedAgainstRoleTitle: "Software Engineer",
        },
      },
    });
  });
});
