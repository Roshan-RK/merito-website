import { describe, it, expect, vi, beforeEach } from "vitest";

function makeQueryStub(result: { data: unknown }) {
  const stub: Record<string, unknown> = {};
  stub.select = () => stub;
  stub.eq = () => stub;
  stub.or = () => stub;
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
const isRecruiterEmailVerifiedMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: fromMock,
    auth: { admin: { getUserById: getUserByIdMock } },
  }),
}));

vi.mock("@/lib/recruiterIdentity", () => ({
  isRecruiterEmailVerified: isRecruiterEmailVerifiedMock,
}));

async function importRoute() {
  return await import("../route");
}

function request(body: Record<string, unknown>, key = "test-key") {
  return new Request("http://localhost/api/public/recruiter-preview/lookup", {
    method: "POST",
    headers: key ? { "x-merito-extension-key": key } : {},
    body: JSON.stringify({ recruiterEmail: "recruiter@example.com", ...body }),
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
      extension_lookups: makeQueryStub({ data: null }),
    };
    fromMock.mockClear();
    fromMock.mockImplementation((table: string) => tableResults[table]);
    getUserByIdMock.mockReset();
    getUserByIdMock.mockResolvedValue({ data: { user: { email: "jane@example.com" } } });
    isRecruiterEmailVerifiedMock.mockReset();
    isRecruiterEmailVerifiedMock.mockResolvedValue(true);
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

  it("returns 400 when extension version is v1.x", async () => {
    const { POST } = await importRoute();
    const req = new Request("http://localhost/api/public/recruiter-preview/lookup", {
      method: "POST",
      headers: {
        "x-merito-extension-key": "test-key",
        "user-agent": "merito-extension/1.5.0",
      },
      body: JSON.stringify({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("upgrade");
  });

  it("returns 400 when extension version is v2.x", async () => {
    const { POST } = await importRoute();
    const req = new Request("http://localhost/api/public/recruiter-preview/lookup", {
      method: "POST",
      headers: {
        "x-merito-extension-key": "test-key",
        "user-agent": "merito-extension/2.9.1",
      },
      body: JSON.stringify({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("upgrade");
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

  it("skips unconfigured leads (no section row)", async () => {
    const sectionCalls: string[] = [];

    function makeSectionStub() {
      const stub: Record<string, unknown> = {};
      stub.select = () => stub;
      stub.eq = (field: string, value: unknown) => {
        if (field === "lead_id") {
          sectionCalls.push(value as string);
        }
        return stub;
      };
      stub.order = () => stub;
      stub.limit = () => stub;
      stub.maybeSingle = async () => {
        // lead-1 has config, lead-2 doesn't
        const lastLeadId = sectionCalls[sectionCalls.length - 1];
        return lastLeadId === "lead-1"
          ? { data: { sections: ["fitment"] } }
          : { data: null };
      };
      return stub;
    }

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

    // Override from mock to return section stub
    fromMock.mockImplementation((table: string) => {
      if (table === "recruiter_preview_sections") {
        return makeSectionStub();
      }
      return tableResults[table];
    });

    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    // Only lead-1 should be in response, lead-2 should be skipped
    expect(body.roles).toHaveLength(1);
    expect(body.roles[0].leadId).toBe("lead-1");
  });

  it("builds the interview section from fitment_interviews directly when status is ready", async () => {
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
          resume_match_raw: null,
        },
      ],
    });
    tableResults.recruiter_preview_sections = makeQueryStub({
      data: { sections: ["interview"] },
    });
    tableResults.fitment_interviews = makeQueryStub({
      data: {
        status: "ready",
        updated_at: "2026-07-28T09:00:00.000Z",
        report_raw: {
          overallScore: 7.5,
          skillMetrics: { sql: 8 },
          overallSummary: "Strong candidate",
          strengths: "SQL",
          skillReport: { sql: { score: 8, comment: "Solid" } },
          approxDurationMinutes: 20,
        },
      },
    });

    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.roles[0].sections.interview).toMatchObject({
      overallScore: 7.5,
      overallSummary: "Strong candidate",
      completedAt: "2026-07-28T09:00:00.000Z",
    });
  });

  it("does not build the interview section when status is not ready", async () => {
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
          resume_match_raw: null,
        },
      ],
    });
    tableResults.recruiter_preview_sections = makeQueryStub({
      data: { sections: ["interview"] },
    });
    tableResults.fitment_interviews = makeQueryStub({
      data: { status: "invited", updated_at: null, report_raw: null },
    });

    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.roles[0].sections.interview).toBeUndefined();
  });

  it("returns 403 when recruiterEmail is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(
      request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", recruiterEmail: undefined })
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: "Please confirm your email first.", verificationRequired: true });
  });

  it("returns 403 when recruiterEmail is not verified", async () => {
    isRecruiterEmailVerifiedMock.mockResolvedValue(false);
    const { POST } = await importRoute();
    const response = await POST(
      request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", recruiterEmail: "unverified@example.com" })
    );
    expect(response.status).toBe(403);
  });

  it("checks verification for the trimmed recruiterEmail", async () => {
    const { POST } = await importRoute();
    await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", recruiterEmail: "  recruiter@example.com  " }));
    expect(isRecruiterEmailVerifiedMock).toHaveBeenCalledWith("recruiter@example.com");
  });

  it("does not record a lookup when recruiterEmail is unverified", async () => {
    isRecruiterEmailVerifiedMock.mockResolvedValue(false);
    const { POST } = await importRoute();
    await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    expect(fromMock).not.toHaveBeenCalledWith("extension_lookups");
  });
});
