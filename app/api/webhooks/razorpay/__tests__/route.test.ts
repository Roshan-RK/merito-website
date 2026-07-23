import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyWebhookSignatureMock = vi.fn();
vi.mock("@/lib/razorpay/client", () => ({
  verifyWebhookSignature: verifyWebhookSignatureMock,
}));

const finalizeRazorpayOrderMock = vi.fn();
vi.mock("@/lib/razorpay/finalize", () => ({
  finalizeRazorpayOrder: finalizeRazorpayOrderMock,
}));

async function importRoute() {
  return await import("../route");
}

function buildRequest(rawBody: string, signature: string | null) {
  const headers = new Headers();
  if (signature !== null) headers.set("x-razorpay-signature", signature);
  return new Request("http://localhost/api/webhooks/razorpay", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/webhooks/razorpay", () => {
  beforeEach(() => {
    verifyWebhookSignatureMock.mockReset();
    finalizeRazorpayOrderMock.mockReset();
    finalizeRazorpayOrderMock.mockResolvedValue({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
  });

  it("returns 401 and never calls finalize when the signature doesn't verify", async () => {
    verifyWebhookSignatureMock.mockReturnValue(false);
    const { POST } = await importRoute();
    const response = await POST(buildRequest('{"event":"payment.captured"}', "bad-signature"));
    expect(response.status).toBe(401);
    expect(finalizeRazorpayOrderMock).not.toHaveBeenCalled();
  });

  it("verifies the raw body against the x-razorpay-signature header", async () => {
    verifyWebhookSignatureMock.mockReturnValue(true);
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
    });
    const { POST } = await importRoute();
    await POST(buildRequest(rawBody, "good-signature"));
    expect(verifyWebhookSignatureMock).toHaveBeenCalledWith(rawBody, "good-signature");
  });

  it("extracts order_id and payment_id from payload.payment.entity and calls finalize", async () => {
    verifyWebhookSignatureMock.mockReturnValue(true);
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
    });
    const { POST } = await importRoute();
    const response = await POST(buildRequest(rawBody, "good-signature"));

    expect(finalizeRazorpayOrderMock).toHaveBeenCalledWith("order_1", "pay_1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it("does not finalize a payment.failed event even though the entity shape matches", async () => {
    verifyWebhookSignatureMock.mockReturnValue(true);
    const rawBody = JSON.stringify({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
    });
    const { POST } = await importRoute();
    const response = await POST(buildRequest(rawBody, "good-signature"));

    expect(finalizeRazorpayOrderMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("still returns 200 without calling finalize when the payload has no payment entity", async () => {
    verifyWebhookSignatureMock.mockReturnValue(true);
    const rawBody = JSON.stringify({ event: "order.paid" });
    const { POST } = await importRoute();
    const response = await POST(buildRequest(rawBody, "good-signature"));

    expect(finalizeRazorpayOrderMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("still returns 200 when finalize reports a rejection (no retry storm)", async () => {
    verifyWebhookSignatureMock.mockReturnValue(true);
    finalizeRazorpayOrderMock.mockResolvedValue({ ok: false, reason: "unsupported_product" });
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
    });
    const { POST } = await importRoute();
    const response = await POST(buildRequest(rawBody, "good-signature"));
    expect(response.status).toBe(200);
  });
});
