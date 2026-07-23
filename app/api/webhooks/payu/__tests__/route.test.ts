import { describe, it, expect, vi, beforeEach } from "vitest";

const finalizePaymentFromPayuMock = vi.fn();
vi.mock("@/lib/payu/finalize", () => ({
  finalizePaymentFromPayu: finalizePaymentFromPayuMock,
}));

async function importRoute() {
  return await import("../route");
}

function buildRequest(fields: Record<string, string>) {
  const params = new URLSearchParams(fields);
  return new Request("http://localhost/api/webhooks/payu", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

describe("POST /api/webhooks/payu", () => {
  beforeEach(() => {
    finalizePaymentFromPayuMock.mockReset();
    finalizePaymentFromPayuMock.mockResolvedValue({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
  });

  it("parses the form-encoded body and calls finalizePaymentFromPayu with all fields", async () => {
    const { POST } = await importRoute();
    const response = await POST(
      buildRequest({
        key: "testkey",
        txnid: "txn-1",
        amount: "299.00",
        productinfo: "Detailed Report",
        firstname: "Rushi",
        email: "rushi@example.com",
        status: "success",
        hash: "somehash",
      })
    );

    expect(finalizePaymentFromPayuMock).toHaveBeenCalledWith({
      key: "testkey",
      txnid: "txn-1",
      amount: "299.00",
      productinfo: "Detailed Report",
      firstname: "Rushi",
      email: "rushi@example.com",
      status: "success",
      hash: "somehash",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it("still returns 200 when finalize rejects the payload (no retry storm)", async () => {
    finalizePaymentFromPayuMock.mockResolvedValue({ ok: false, reason: "invalid_hash" });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ txnid: "txn-1", status: "success" }));
    expect(response.status).toBe(200);
  });
});
