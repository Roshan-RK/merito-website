import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const recordManualReconciliationMock = vi.fn();
vi.mock("@/lib/adminPayments", () => ({ recordManualReconciliation: recordManualReconciliationMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/payments/reconcile", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/admin/payments/reconcile", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
    recordManualReconciliationMock.mockReset();
    recordManualReconciliationMock.mockResolvedValue(undefined);
  });

  it("records the reconciliation and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ userId: "user-1", leadId: "lead-1", product: "report", amountPaise: 29900 }));

    expect(response.status).toBe(200);
    expect(recordManualReconciliationMock).toHaveBeenCalledWith(
      { userId: "user-1", leadId: "lead-1", product: "report", amountPaise: 29900 },
      "rushi.humbe@gmail.com"
    );
  });

  it("returns 400 when amountPaise is not a positive integer", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ userId: "user-1", leadId: null, product: "personality", amountPaise: 0 }));

    expect(response.status).toBe(400);
    expect(recordManualReconciliationMock).not.toHaveBeenCalled();
  });
});
