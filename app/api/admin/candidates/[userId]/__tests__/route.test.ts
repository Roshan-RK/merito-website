import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/adminAuth")>("@/lib/adminAuth");
  return { ...actual, requireAdmin: requireAdminMock };
});

const deleteCandidateMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ deleteCandidate: deleteCandidateMock }));

const enforceAdminRateLimitMock = vi.fn();
vi.mock("@/lib/adminRateLimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/adminRateLimit")>("@/lib/adminRateLimit");
  return { ...actual, enforceAdminRateLimit: enforceAdminRateLimitMock };
});

describe("DELETE /api/admin/candidates/[userId]", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in", last_sign_in_at: new Date().toISOString() });
    deleteCandidateMock.mockReset();
    deleteCandidateMock.mockResolvedValue(undefined);
    enforceAdminRateLimitMock.mockReset();
    enforceAdminRateLimitMock.mockResolvedValue(undefined);
  });

  it("deletes the candidate and returns ok", async () => {
    const { DELETE } = await import("../route");

    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(200);
    expect(deleteCandidateMock).toHaveBeenCalledWith("user-1", "roshan@merito.in");
  });

  it("returns 409 when the candidate is already deleted", async () => {
    deleteCandidateMock.mockRejectedValue(new Error("Failed to delete candidate: User not found"));
    const { DELETE } = await import("../route");

    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(409);
  });

  it("returns 401 when the admin's last sign-in is too old", async () => {
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in", last_sign_in_at: new Date(Date.now() - 31 * 60_000).toISOString() });
    const { DELETE } = await import("../route");

    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(401);
    expect(deleteCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    const { RateLimitExceededError } = await import("@/lib/adminRateLimit");
    enforceAdminRateLimitMock.mockRejectedValue(new RateLimitExceededError("candidate.soft_delete"));
    const { DELETE } = await import("../route");

    const response = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(429);
    expect(deleteCandidateMock).not.toHaveBeenCalled();
  });
});
