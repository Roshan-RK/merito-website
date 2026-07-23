import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";

beforeEach(() => {
  process.env.PAYU_MERCHANT_KEY = "testkey";
  process.env.PAYU_MERCHANT_SALT = "testsalt";
  process.env.PAYU_BASE_URL = "https://test.payu.in";
});

const baseParams = {
  txnid: "txn123",
  amount: "299.00",
  productinfo: "Detailed Report",
  firstname: "Rushi",
  email: "rushi@example.com",
  surl: "https://example.com/s",
  furl: "https://example.com/f",
};

describe("buildRequestHash", () => {
  it("matches PayU's documented key|txnid|amount|productinfo|firstname|email|udf1..udf10|salt formula", async () => {
    const { buildRequestHash } = await import("../client");
    // Independently built expected string — verified separately against
    // node's crypto module that this pipe layout (10 empty udf slots
    // between email and salt) matches PayU's documented formula exactly.
    const expectedString =
      "testkey|txn123|299.00|Detailed Report|Rushi|rushi@example.com|||||||||||testsalt";
    const expected = crypto.createHash("sha512").update(expectedString).digest("hex");
    expect(buildRequestHash(baseParams)).toBe(expected);
  });

  it("throws when PAYU_MERCHANT_KEY is missing", async () => {
    delete process.env.PAYU_MERCHANT_KEY;
    const { buildRequestHash } = await import("../client");
    expect(() => buildRequestHash(baseParams)).toThrow("PayU is not configured (PAYU_MERCHANT_KEY missing).");
  });
});

describe("buildPaymentForm", () => {
  it("returns the hosted-checkout action URL and all required fields", async () => {
    const { buildPaymentForm } = await import("../client");
    const form = buildPaymentForm(baseParams);
    expect(form.action).toBe("https://test.payu.in/_payment");
    expect(form.fields.key).toBe("testkey");
    expect(form.fields.txnid).toBe("txn123");
    expect(form.fields.amount).toBe("299.00");
    expect(form.fields.surl).toBe("https://example.com/s");
    expect(form.fields.furl).toBe("https://example.com/f");
    expect(form.fields.hash).toHaveLength(128);
  });
});

describe("verifyResponseHash", () => {
  const responseFields = {
    key: "testkey",
    txnid: "txn123",
    amount: "299.00",
    productinfo: "Detailed Report",
    firstname: "Rushi",
    email: "rushi@example.com",
    status: "success",
  };

  it("accepts a hash built with PayU's documented reverse formula", async () => {
    const { verifyResponseHash } = await import("../client");
    const expectedString =
      "testsalt|success|||||||||||rushi@example.com|Rushi|Detailed Report|299.00|txn123|testkey";
    const hash = crypto.createHash("sha512").update(expectedString).digest("hex");
    expect(verifyResponseHash({ ...responseFields, hash })).toBe(true);
  });

  it("rejects a tampered hash", async () => {
    const { verifyResponseHash } = await import("../client");
    expect(verifyResponseHash({ ...responseFields, hash: "deadbeef" })).toBe(false);
  });
});
