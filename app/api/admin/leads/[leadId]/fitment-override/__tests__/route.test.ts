import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const overrideFitmentReportMock = vi.fn();
const clearFitmentOverrideMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({
  overrideFitmentReport: overrideFitmentReportMock,
  clearFitmentOverride: clearFitmentOverrideMock,
}));

function buildRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/admin/leads/lead-1/fitment-override", {
    method,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
  overrideFitmentReportMock.mockReset();
  overrideFitmentReportMock.mockResolvedValue(undefined);
  clearFitmentOverrideMock.mockReset();
  clearFitmentOverrideMock.mockResolvedValue(undefined);
});

describe("POST /api/admin/leads/[leadId]/fitment-override", () => {
  it("overrides the report and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest("POST", { overallScore: 90, summary: "Strong fit", reason: "resume was misparsed" }), {
      params: Promise.resolve({ leadId: "lead-1" }),
    });

    expect(response.status).toBe(200);
    expect(overrideFitmentReportMock).toHaveBeenCalledWith(
      "lead-1",
      { overallScore: 90, summary: "Strong fit" },
      "roshan@merito.in",
      "resume was misparsed"
    );
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest("POST", { overallScore: 90, summary: "x" }), { params: Promise.resolve({ leadId: "lead-1" }) });

    expect(response.status).toBe(400);
    expect(overrideFitmentReportMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an out-of-range score", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest("POST", { overallScore: 150, summary: "x", reason: "x" }), {
      params: Promise.resolve({ leadId: "lead-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 409 when the override fails", async () => {
    overrideFitmentReportMock.mockRejectedValue(new Error("Fitment report isn't ready yet."));
    const { POST } = await import("../route");

    const response = await POST(buildRequest("POST", { overallScore: 90, summary: "x", reason: "x" }), {
      params: Promise.resolve({ leadId: "lead-1" }),
    });

    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/admin/leads/[leadId]/fitment-override", () => {
  it("clears the override and returns ok", async () => {
    const { DELETE } = await import("../route");

    const response = await DELETE(buildRequest("DELETE", { reason: "resync needed" }), { params: Promise.resolve({ leadId: "lead-1" }) });

    expect(response.status).toBe(200);
    expect(clearFitmentOverrideMock).toHaveBeenCalledWith("lead-1", "roshan@merito.in", "resync needed");
  });

  it("returns 400 when reason is missing", async () => {
    const { DELETE } = await import("../route");

    const response = await DELETE(buildRequest("DELETE", {}), { params: Promise.resolve({ leadId: "lead-1" }) });

    expect(response.status).toBe(400);
    expect(clearFitmentOverrideMock).not.toHaveBeenCalled();
  });
});
