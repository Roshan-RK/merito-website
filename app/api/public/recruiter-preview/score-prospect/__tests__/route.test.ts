import { describe, it, expect, vi, beforeEach } from "vitest";

const scoreProspectMock = vi.fn();
vi.mock("@/lib/recruiterSourcedProspects", () => ({ scoreProspect: scoreProspectMock }));

async function importRoute() {
  return await import("../route");
}

function request(body: unknown, key = "test-key") {
  return new Request("http://localhost/api/public/recruiter-preview/score-prospect", {
    method: "POST",
    headers: key ? { "x-merito-extension-key": key } : {},
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  recruiterEmail: "recruiter@example.com",
  linkedinUrl: "https://www.linkedin.com/in/jane-doe",
  jdText: "We need a backend engineer.",
  candidateLevel: "mid",
  candidateFields: { name: "Jane Doe", headline: "Engineer", experience: [], education: [], skills: [] },
};

describe("POST /api/public/recruiter-preview/score-prospect", () => {
  beforeEach(() => {
    vi.stubEnv("RECRUITER_EXTENSION_KEY", "test-key");
    scoreProspectMock.mockReset();
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

  it("returns 403 with verificationRequired when the recruiter email isn't verified", async () => {
    scoreProspectMock.mockResolvedValue({ status: "verification_required" });
    const { POST } = await importRoute();
    const response = await POST(request(VALID_BODY));
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.verificationRequired).toBe(true);
  });

  it("returns 429 when the monthly cap is exceeded", async () => {
    scoreProspectMock.mockResolvedValue({ status: "cap_exceeded" });
    const { POST } = await importRoute();
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(429);
  });

  it("returns 502 when scoring fails", async () => {
    scoreProspectMock.mockResolvedValue({ status: "failed" });
    const { POST } = await importRoute();
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(502);
  });

  it("returns 200 with prospectId and fitment on success", async () => {
    scoreProspectMock.mockResolvedValue({
      status: "ready",
      prospectId: "prospect-1",
      report: { overallScore: 82, rank: null, categories: [], summary: "Good fit", strongPoints: [], weakPoints: [] },
    });
    const { POST } = await importRoute();
    const response = await POST(request(VALID_BODY));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.prospectId).toBe("prospect-1");
    expect(body.fitment.report.overallScore).toBe(82);
  });
});
