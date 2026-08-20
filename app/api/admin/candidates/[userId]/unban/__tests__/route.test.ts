import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const unbanCandidateMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ unbanCandidate: unbanCandidateMock }));

describe("POST /api/admin/candidates/[userId]/unban", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    unbanCandidateMock.mockReset();
    unbanCandidateMock.mockResolvedValue(undefined);
  });

  it("unbans the candidate and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(200);
    expect(unbanCandidateMock).toHaveBeenCalledWith("user-1", "roshan@merito.in");
  });
});
