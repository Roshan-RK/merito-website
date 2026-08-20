import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const retryInterviewFromFailureMock = vi.fn();
vi.mock("@/lib/pipelineFailures", () => ({ retryInterviewFromFailure: retryInterviewFromFailureMock }));

describe("POST /api/admin/pipeline-failures/[id]/retry-interview", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
    retryInterviewFromFailureMock.mockReset();
    retryInterviewFromFailureMock.mockResolvedValue(undefined);
  });

  it("retries and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ id: "failure-1" }),
    });

    expect(response.status).toBe(200);
    expect(retryInterviewFromFailureMock).toHaveBeenCalledWith("failure-1", "rushi.humbe@gmail.com");
  });

  it("returns 409 when not eligible", async () => {
    retryInterviewFromFailureMock.mockRejectedValue(new Error("Pipeline failure not found or not eligible for retry."));
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ id: "failure-1" }),
    });

    expect(response.status).toBe(409);
  });
});
