import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";

beforeEach(() => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "testsecret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhooksecret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createOrder", () => {
  it("posts to the Razorpay orders API with Basic auth and returns the order id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_ABC123", amount: 29900, currency: "INR", status: "created" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createOrder } = await import("../client");
    const result = await createOrder({ amountPaise: 29900, currency: "INR", receipt: "lead-1-report" });

    expect(result).toEqual({ orderId: "order_ABC123" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/orders",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("rzp_test_key:testsecret").toString("base64")}`,
        }),
      })
    );
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sentBody).toEqual({ amount: 29900, currency: "INR", receipt: "lead-1-report" });
  });

  it("throws when the Razorpay API responds with a non-2xx status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Authentication failed",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createOrder } = await import("../client");
    await expect(createOrder({ amountPaise: 29900, currency: "INR", receipt: "lead-1-report" })).rejects.toThrow(
      "Razorpay order creation failed (401): Authentication failed"
    );
  });

  it("throws when RAZORPAY_KEY_ID is missing", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    const { createOrder } = await import("../client");
    await expect(createOrder({ amountPaise: 29900, currency: "INR", receipt: "lead-1-report" })).rejects.toThrow(
      "Razorpay is not configured (RAZORPAY_KEY_ID missing)."
    );
  });
});

describe("verifyPaymentSignature", () => {
  it("accepts a signature built with HMAC-SHA256(orderId + '|' + paymentId, key_secret)", async () => {
    const { verifyPaymentSignature } = await import("../client");
    const signature = crypto.createHmac("sha256", "testsecret").update("order_ABC123|pay_XYZ789").digest("hex");

    expect(
      verifyPaymentSignature({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature })
    ).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const { verifyPaymentSignature } = await import("../client");
    expect(
      verifyPaymentSignature({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature: "deadbeef" })
    ).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a signature built with HMAC-SHA256(raw_body, webhook_secret)", async () => {
    const { verifyWebhookSignature } = await import("../client");
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const signature = crypto.createHmac("sha256", "webhooksecret").update(rawBody).digest("hex");

    expect(verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it("rejects a missing signature header", async () => {
    const { verifyWebhookSignature } = await import("../client");
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const { verifyWebhookSignature } = await import("../client");
    expect(verifyWebhookSignature("{}", "deadbeef")).toBe(false);
  });
});
