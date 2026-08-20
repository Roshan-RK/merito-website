import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/adminAuth")>("@/lib/adminAuth");
  return { ...actual, requireAdmin: requireAdminMock };
});

const refundTransactionMock = vi.fn();
vi.mock("@/lib/adminPayments", () => ({ refundTransaction: refundTransactionMock }));

const enforceAdminRateLimitMock = vi.fn();
vi.mock("@/lib/adminRateLimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/adminRateLimit")>("@/lib/adminRateLimit");
  return { ...actual, enforceAdminRateLimit: enforceAdminRateLimitMock };
});

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/payments/order-1/refund", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/admin/payments/[orderId]/refund", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "admin@merito.in", last_sign_in_at: new Date().toISOString() });
    refundTransactionMock.mockReset();
    refundTransactionMock.mockResolvedValue(undefined);
    enforceAdminRateLimitMock.mockReset();
    enforceAdminRateLimitMock.mockResolvedValue(undefined);
  });

  it("refunds and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ reason: "candidate requested" }), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(200);
    expect(refundTransactionMock).toHaveBeenCalledWith("order-1", "candidate requested", "admin@merito.in");
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({}), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(400);
    expect(refundTransactionMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the transaction is not refundable", async () => {
    refundTransactionMock.mockRejectedValue(new Error("Transaction is not refundable in its current state (refunded)."));
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ reason: "x" }), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(409);
  });

  it("returns 401 when the admin's last sign-in is too old", async () => {
    requireAdminMock.mockResolvedValue({ email: "admin@merito.in", last_sign_in_at: new Date(Date.now() - 31 * 60_000).toISOString() });
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ reason: "x" }), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(401);
    expect(refundTransactionMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    const { RateLimitExceededError } = await import("@/lib/adminRateLimit");
    enforceAdminRateLimitMock.mockRejectedValue(new RateLimitExceededError("payment.refund"));
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ reason: "x" }), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(429);
    expect(refundTransactionMock).not.toHaveBeenCalled();
  });
});
