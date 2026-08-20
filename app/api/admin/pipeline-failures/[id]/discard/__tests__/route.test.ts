import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const discardPipelineFailureMock = vi.fn();
vi.mock("@/lib/pipelineFailures", () => ({ discardPipelineFailure: discardPipelineFailureMock }));

describe("POST /api/admin/pipeline-failures/[id]/discard", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    discardPipelineFailureMock.mockReset();
    discardPipelineFailureMock.mockResolvedValue(undefined);
  });

  it("discards and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ id: "failure-1" }),
    });

    expect(response.status).toBe(200);
    expect(discardPipelineFailureMock).toHaveBeenCalledWith("failure-1", "roshan@merito.in");
  });
});
