import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const overrideInterviewReportMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ overrideInterviewReport: overrideInterviewReportMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/interviews/row-1/report-override", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
  overrideInterviewReportMock.mockReset();
  overrideInterviewReportMock.mockResolvedValue(undefined);
});

describe("POST /api/admin/interviews/[id]/report-override", () => {
  it("overrides the report and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ overallScore: 9, overallSummary: "Strong performance", reason: "misjudged tone" }), {
      params: Promise.resolve({ id: "row-1" }),
    });

    expect(response.status).toBe(200);
    expect(overrideInterviewReportMock).toHaveBeenCalledWith(
      "row-1",
      { overallScore: 9, overallSummary: "Strong performance" },
      "roshan@merito.in",
      "misjudged tone"
    );
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ overallScore: 9, overallSummary: "x" }), { params: Promise.resolve({ id: "row-1" }) });

    expect(response.status).toBe(400);
    expect(overrideInterviewReportMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an out-of-range score", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ overallScore: 15, overallSummary: "x", reason: "x" }), {
      params: Promise.resolve({ id: "row-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 409 when the override fails", async () => {
    overrideInterviewReportMock.mockRejectedValue(new Error("Interview report isn't ready yet."));
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ overallScore: 9, overallSummary: "x", reason: "x" }), {
      params: Promise.resolve({ id: "row-1" }),
    });

    expect(response.status).toBe(409);
  });
});
