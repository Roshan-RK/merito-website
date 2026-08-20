import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const retryResumeMatchMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ retryResumeMatch: retryResumeMatchMock }));

describe("POST /api/admin/leads/[leadId]/retry-resume-match", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    retryResumeMatchMock.mockReset();
    retryResumeMatchMock.mockResolvedValue(undefined);
  });

  it("retries and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ leadId: "lead-1" }),
    });

    expect(response.status).toBe(200);
    expect(retryResumeMatchMock).toHaveBeenCalledWith("lead-1", "roshan@merito.in");
  });

  it("returns 409 when IntervueBox still has no result", async () => {
    retryResumeMatchMock.mockRejectedValue(new Error("IntervueBox still hasn't produced a result for this candidate."));
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ leadId: "lead-1" }),
    });

    expect(response.status).toBe(409);
  });
});
