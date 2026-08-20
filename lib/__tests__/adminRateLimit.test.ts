import { describe, it, expect, vi, beforeEach } from "vitest";

const selectMock = vi.fn();
const eqMock1 = vi.fn();
const eqMock2 = vi.fn();
const gteMock = vi.fn();
const insertMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("enforceAdminRateLimit", () => {
  beforeEach(() => {
    fromMock.mockReset();
    selectMock.mockReset();
    eqMock1.mockReset();
    eqMock2.mockReset();
    gteMock.mockReset();
    insertMock.mockReset();

    fromMock.mockReturnValue({ select: selectMock, insert: insertMock });
    selectMock.mockReturnValue({ eq: eqMock1 });
    eqMock1.mockReturnValue({ eq: eqMock2 });
    eqMock2.mockReturnValue({ gte: gteMock });
    insertMock.mockResolvedValue({ error: null });
  });

  it("records the event and returns when under the burst cap", async () => {
    gteMock.mockResolvedValue({ count: 3, error: null });
    const { enforceAdminRateLimit } = await import("../adminRateLimit");

    await expect(enforceAdminRateLimit("admin@merito.in", "candidate.ban")).resolves.toBeUndefined();

    expect(fromMock).toHaveBeenCalledWith("admin_rate_limit_events");
    expect(insertMock).toHaveBeenCalledWith({ admin_email: "admin@merito.in", action_key: "candidate.ban" });
  });

  it("throws RateLimitExceededError and does not record a new event once the cap is hit", async () => {
    gteMock.mockResolvedValue({ count: 20, error: null });
    const { enforceAdminRateLimit, RateLimitExceededError } = await import("../adminRateLimit");

    await expect(enforceAdminRateLimit("admin@merito.in", "payment.refund")).rejects.toThrow(RateLimitExceededError);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("throws when the count query errors", async () => {
    gteMock.mockResolvedValue({ count: null, error: { message: "db down" } });
    const { enforceAdminRateLimit } = await import("../adminRateLimit");

    await expect(enforceAdminRateLimit("admin@merito.in", "candidate.ban")).rejects.toThrow("Failed to check rate limit: db down");
  });

  it("throws when recording the event fails", async () => {
    gteMock.mockResolvedValue({ count: 0, error: null });
    insertMock.mockResolvedValue({ error: { message: "insert failed" } });
    const { enforceAdminRateLimit } = await import("../adminRateLimit");

    await expect(enforceAdminRateLimit("admin@merito.in", "candidate.ban")).rejects.toThrow("Failed to record rate limit event: insert failed");
  });
});
