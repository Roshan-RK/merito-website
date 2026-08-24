import { describe, it, expect, vi, beforeEach } from "vitest";

const getProspectScoreStatusMock = vi.fn();
vi.mock("@/lib/recruiterSourcedProspects", () => ({
  getProspectScoreStatus: getProspectScoreStatusMock,
}));

const isRecruiterEmailVerifiedMock = vi.fn();
vi.mock("@/lib/recruiterIdentity", () => ({
  isRecruiterEmailVerified: isRecruiterEmailVerifiedMock,
}));

async function importRoute() {
  return await import("../route");
}

function request(params: Record<string, string>, key = "test-key") {
  const url = new URL("http://localhost/api/public/recruiter-preview/score-prospect/status");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url, {
    headers: key ? { "x-merito-extension-key": key } : {},
  });
}

const VALID_PARAMS = { prospectId: "p1", recruiterEmail: "recruiter@example.com" };

describe("GET /api/public/recruiter-preview/score-prospect/status", () => {
  beforeEach(() => {
    vi.stubEnv("RECRUITER_EXTENSION_KEY", "test-key");
    getProspectScoreStatusMock.mockReset();
    isRecruiterEmailVerifiedMock.mockReset();
    isRecruiterEmailVerifiedMock.mockResolvedValue(true);
  });

  it("returns 401 when the key header is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(request(VALID_PARAMS, ""));
    expect(response.status).toBe(401);
  });

  it("returns 404 when prospectId is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(request({ recruiterEmail: "recruiter@example.com" }));
    expect(response.status).toBe(404);
  });

  it("returns 403 when recruiterEmail is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(request({ prospectId: "p1" }));
    expect(response.status).toBe(403);
    expect(getProspectScoreStatusMock).not.toHaveBeenCalled();
  });

  it("returns 403 when recruiterEmail is not verified", async () => {
    isRecruiterEmailVerifiedMock.mockResolvedValue(false);
    const { GET } = await importRoute();
    const response = await GET(request(VALID_PARAMS));
    expect(response.status).toBe(403);
    expect(getProspectScoreStatusMock).not.toHaveBeenCalled();
  });

  it("returns pending status when scoring is still in progress", async () => {
    getProspectScoreStatusMock.mockResolvedValue({ status: "pending" });
    const { GET } = await importRoute();
    const response = await GET(request(VALID_PARAMS));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "pending" });
  });

  it("returns 502 when scoring failed", async () => {
    getProspectScoreStatusMock.mockResolvedValue({ status: "failed" });
    const { GET } = await importRoute();
    const response = await GET(request(VALID_PARAMS));
    expect(response.status).toBe(502);
  });

  it("returns ready status with fitment when scoring is complete", async () => {
    getProspectScoreStatusMock.mockResolvedValue({
      status: "ready",
      prospectId: "p1",
      jdText: "Backend role",
      report: { overallScore: 80, rank: null, categories: [], summary: "Good fit", strongPoints: [], weakPoints: [] },
    });
    const { GET } = await importRoute();
    const response = await GET(request(VALID_PARAMS));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.fitment.report.overallScore).toBe(80);
  });
});
