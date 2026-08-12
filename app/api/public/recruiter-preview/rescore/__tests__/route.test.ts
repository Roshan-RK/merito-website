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
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

const getCachedRescoreMock = vi.fn();
const runRescoreMock = vi.fn();
vi.mock("@/lib/recruiterJdRescore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/recruiterJdRescore")>();
  return {
    ...actual,
    getCachedRescore: getCachedRescoreMock,
    runRescore: runRescoreMock,
  };
});

async function importRoute() {
  return await import("../route");
}

function request(body: unknown, key = "test-key") {
  return new Request("http://localhost/api/public/recruiter-preview/rescore", {
    method: "POST",
    headers: key ? { "x-merito-extension-key": key } : {},
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { linkedinUrl: "https://www.linkedin.com/in/jane-doe", jdText: "We need a backend engineer." };

describe("POST /api/public/recruiter-preview/rescore", () => {
  beforeEach(() => {
    vi.stubEnv("RECRUITER_EXTENSION_KEY", "test-key");
    tableResults = {
      recruiter_preview_settings: makeQueryStub({ data: null }),
      fitment_leads: makeQueryStub({ data: [] }),
    };
    fromMock.mockClear();
    getCachedRescoreMock.mockReset().mockResolvedValue(null);
    runRescoreMock.mockReset();
  });

  it("returns 401 when the key header is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(request(VALID_BODY, ""));
    expect(response.status).toBe(401);
  });

  it("returns 404 on a malformed linkedinUrl", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ ...VALID_BODY, linkedinUrl: "not-a-url" }));
    expect(response.status).toBe(404);
  });

  it("returns 404 when jdText is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: VALID_BODY.linkedinUrl }));
    expect(response.status).toBe(404);
  });

  it("returns 404 when no candidate matches or is disabled", async () => {
    const { POST } = await importRoute();
    const response = await POST(request(VALID_BODY));
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Not found." });
  });

  it("returns the cached fitment without calling runRescore on a cache hit", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    getCachedRescoreMock.mockResolvedValue({ overallScore: 88, rank: null, categories: [], summary: "Great", strongPoints: [], weakPoints: [] });

    const { POST } = await importRoute();
    const response = await POST(request(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fitment.report.overallScore).toBe(88);
    expect(runRescoreMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the candidate has no stored resume yet", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({ data: [{ ib_resume_id: null }] });

    const { POST } = await importRoute();
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(404);
  });

  it("runs a fresh rescore on a cache miss and returns it", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({
      data: [{ ib_resume_id: "RES_1", name: "Jane Doe", email: "jane@example.com", phone: "9999999999", candidate_level: "mid" }],
    });
    runRescoreMock.mockResolvedValue({ overallScore: 70, rank: null, categories: [], summary: "Decent", strongPoints: [], weakPoints: [] });

    const { POST } = await importRoute();
    const response = await POST(request(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fitment.report.overallScore).toBe(70);
    expect(runRescoreMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", ibResumeId: "RES_1", candidateLevel: "mid" }),
      VALID_BODY.jdText,
      expect.any(String)
    );
  });

  it("passes the lead's stored resume_text through as resumeText for skill grounding", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({
      data: [{ ib_resume_id: "RES_1", name: "Jane Doe", email: "jane@example.com", phone: "9999999999", candidate_level: "mid", resume_text: "Built AWS partnerships." }],
    });
    runRescoreMock.mockResolvedValue({ overallScore: 70, rank: null, categories: [], summary: "Decent", strongPoints: [], weakPoints: [] });

    const { POST } = await importRoute();
    await POST(request(VALID_BODY));

    expect(runRescoreMock).toHaveBeenCalledWith(
      expect.objectContaining({ resumeText: "Built AWS partnerships." }),
      VALID_BODY.jdText,
      expect.any(String)
    );
  });

  it("returns 429 after exceeding the per-candidate rate limit", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "rate-limit-user" } });
    tableResults.fitment_leads = makeQueryStub({
      data: [{ ib_resume_id: "RES_1", name: "Jane Doe", email: "jane@example.com", phone: "9999999999", candidate_level: "mid" }],
    });
    runRescoreMock.mockResolvedValue({ overallScore: 50, rank: null, categories: [], summary: "OK", strongPoints: [], weakPoints: [] });

    const { POST } = await importRoute();
    let lastStatus = 200;
    for (let i = 0; i < 6; i++) {
      // distinct jdText per call so the cache never short-circuits before the limit is hit
      const response = await POST(request({ ...VALID_BODY, jdText: `JD attempt ${i}` }));
      lastStatus = response.status;
    }
    expect(lastStatus).toBe(429);
  });
});
