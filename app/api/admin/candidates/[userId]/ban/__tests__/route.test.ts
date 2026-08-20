import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/adminAuth")>("@/lib/adminAuth");
  return { ...actual, requireAdmin: requireAdminMock };
});

const banCandidateMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ banCandidate: banCandidateMock }));

const enforceAdminRateLimitMock = vi.fn();
vi.mock("@/lib/adminRateLimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/adminRateLimit")>("@/lib/adminRateLimit");
  return { ...actual, enforceAdminRateLimit: enforceAdminRateLimitMock };
});

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/candidates/user-1/ban", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/candidates/[userId]/ban", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in", last_sign_in_at: new Date().toISOString() });
    banCandidateMock.mockReset();
    banCandidateMock.mockResolvedValue(undefined);
    enforceAdminRateLimitMock.mockReset();
    enforceAdminRateLimitMock.mockResolvedValue(undefined);
  });

  it("bans the candidate and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ reason: "spam" }), { params: Promise.resolve({ userId: "user-1" }) });

    expect(response.status).toBe(200);
    expect(banCandidateMock).toHaveBeenCalledWith("user-1", "roshan@merito.in", "spam");
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({}), { params: Promise.resolve({ userId: "user-1" }) });

    expect(response.status).toBe(400);
    expect(banCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the admin's last sign-in is too old", async () => {
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in", last_sign_in_at: new Date(Date.now() - 31 * 60_000).toISOString() });
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ reason: "spam" }), { params: Promise.resolve({ userId: "user-1" }) });

    expect(response.status).toBe(401);
    expect(banCandidateMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    const { RateLimitExceededError } = await import("@/lib/adminRateLimit");
    enforceAdminRateLimitMock.mockRejectedValue(new RateLimitExceededError("candidate.ban"));
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ reason: "spam" }), { params: Promise.resolve({ userId: "user-1" }) });

    expect(response.status).toBe(429);
    expect(banCandidateMock).not.toHaveBeenCalled();
  });
});
