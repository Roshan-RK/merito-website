import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const voidStuckTransactionMock = vi.fn();
vi.mock("@/lib/adminPayments", () => ({ voidStuckTransaction: voidStuckTransactionMock }));

function buildRequest() {
  return new Request("http://localhost/api/admin/payments/order-1/void", { method: "POST" });
}

describe("POST /api/admin/payments/[orderId]/void", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "admin@merito.in" });
    voidStuckTransactionMock.mockReset();
    voidStuckTransactionMock.mockResolvedValue(undefined);
  });

  it("voids and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest(), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(200);
    expect(voidStuckTransactionMock).toHaveBeenCalledWith("order-1", "admin@merito.in");
  });

  it("returns 409 when the transaction can't be voided", async () => {
    voidStuckTransactionMock.mockRejectedValue(new Error("Only initiated transactions can be voided (current status: success)."));
    const { POST } = await import("../route");

    const response = await POST(buildRequest(), { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(409);
  });
});
