import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const banRecruiterMock = vi.fn();
vi.mock("@/lib/adminRecruiters", () => ({ banRecruiter: banRecruiterMock }));

const enforceAdminRateLimitMock = vi.fn();
vi.mock("@/lib/adminRateLimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/adminRateLimit")>("@/lib/adminRateLimit");
  return { ...actual, enforceAdminRateLimit: enforceAdminRateLimitMock };
});

describe("POST /api/admin/recruiters/[email]/ban", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
    banRecruiterMock.mockReset();
    banRecruiterMock.mockResolvedValue(undefined);
    enforceAdminRateLimitMock.mockReset();
    enforceAdminRateLimitMock.mockResolvedValue(undefined);
  });

  it("bans the recruiter and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ reason: "abuse" }) }),
      { params: Promise.resolve({ email: "recruiter@company.com" }) }
    );

    expect(response.status).toBe(200);
    expect(banRecruiterMock).toHaveBeenCalledWith("recruiter@company.com", "rushi.humbe@gmail.com", "abuse");
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({}) }), {
      params: Promise.resolve({ email: "recruiter@company.com" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    const { RateLimitExceededError } = await import("@/lib/adminRateLimit");
    enforceAdminRateLimitMock.mockRejectedValue(new RateLimitExceededError("recruiter.ban"));
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ reason: "abuse" }) }),
      { params: Promise.resolve({ email: "recruiter@company.com" }) }
    );

    expect(response.status).toBe(429);
    expect(banRecruiterMock).not.toHaveBeenCalled();
  });
});
