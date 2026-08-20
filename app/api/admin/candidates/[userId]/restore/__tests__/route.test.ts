import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const restoreCandidateMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ restoreCandidate: restoreCandidateMock }));

describe("POST /api/admin/candidates/[userId]/restore", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
    restoreCandidateMock.mockReset();
    restoreCandidateMock.mockResolvedValue(undefined);
  });

  it("restores the candidate and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(200);
    expect(restoreCandidateMock).toHaveBeenCalledWith("user-1", "rushi.humbe@gmail.com");
  });

  it("returns 409 when restore fails", async () => {
    restoreCandidateMock.mockRejectedValue(new Error("Failed to restore candidate: user not found"));
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(409);
  });
});
