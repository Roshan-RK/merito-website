import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

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
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
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
