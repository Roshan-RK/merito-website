import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyRecaptchaToken } from "../recaptcha";

describe("verifyRecaptchaToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when Google reports success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
    );
    const result = await verifyRecaptchaToken("good-token", "secret");
    expect(result).toBe(true);
  });

  it("returns false when Google reports failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      })
    );
    const result = await verifyRecaptchaToken("bad-token", "secret");
    expect(result).toBe(false);
  });

  it("returns false when the request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    );
    const result = await verifyRecaptchaToken("token", "secret");
    expect(result).toBe(false);
  });
});
