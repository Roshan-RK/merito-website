import { describe, it, expect, vi, beforeEach } from "vitest";

const getProspectScoreStatusMock = vi.fn();
vi.mock("@/lib/recruiterSourcedProspects", () => ({ getProspectScoreStatus: getProspectScoreStatusMock }));

async function importRoute() {
  return await import("../route");
}

function request(prospectId: string | null, key = "test-key") {
  const url = new URL("http://localhost/api/public/recruiter-preview/score-prospect/status");
  if (prospectId !== null) url.searchParams.set("prospectId", prospectId);
  return new Request(url, { headers: key ? { "x-merito-extension-key": key } : {} });
}

describe("GET /api/public/recruiter-preview/score-prospect/status", () => {
  beforeEach(() => {
    vi.stubEnv("RECRUITER_EXTENSION_KEY", "test-key");
    getProspectScoreStatusMock.mockReset();
  });

  it("returns 401 when the key header is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(request("prospect-1", ""));
    expect(response.status).toBe(401);
  });

  it("returns 404 when prospectId is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(request(null));
    expect(response.status).toBe(404);
  });

  it("returns 200 with status:pending while scoring is still running", async () => {
    getProspectScoreStatusMock.mockResolvedValue({ status: "pending" });
    const { GET } = await importRoute();
    const response = await GET(request("prospect-1"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "pending" });
  });

  it("returns 502 when scoring failed", async () => {
    getProspectScoreStatusMock.mockResolvedValue({ status: "failed" });
    const { GET } = await importRoute();
    const response = await GET(request("prospect-1"));
    expect(response.status).toBe(502);
  });

  it("returns 200 with fitment once scoring is ready", async () => {
    getProspectScoreStatusMock.mockResolvedValue({
      status: "ready",
      prospectId: "prospect-1",
      report: { overallScore: 82, rank: null, categories: [], summary: "Good fit", strongPoints: [], weakPoints: [] },
      jdText: "We need a backend engineer.",
    });
    const { GET } = await importRoute();
    const response = await GET(request("prospect-1"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.fitment.report.overallScore).toBe(82);
  });
});
