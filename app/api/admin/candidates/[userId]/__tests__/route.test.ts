import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const deleteCandidateMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ deleteCandidate: deleteCandidateMock }));

describe("DELETE /api/admin/candidates/[userId]", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
    deleteCandidateMock.mockReset();
    deleteCandidateMock.mockResolvedValue(undefined);
  });

  it("deletes the candidate and returns ok", async () => {
    const { DELETE } = await import("../route");

    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(200);
    expect(deleteCandidateMock).toHaveBeenCalledWith("user-1", "rushi.humbe@gmail.com");
  });

  it("returns 409 when the candidate is already deleted", async () => {
    deleteCandidateMock.mockRejectedValue(new Error("Failed to delete candidate: User not found"));
    const { DELETE } = await import("../route");

    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(409);
  });
});
