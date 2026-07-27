import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => {
  return {
    Resend: class {
      emails = { send: sendMock };
    },
  };
});

const ORIGINAL_ENV = { ...process.env };

describe("paymentEmails", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    process.env = {
      ...ORIGINAL_ENV,
      RESEND_API_KEY: "re_test",
      CONTACT_FROM_EMAIL: "admin@merito.ai",
      CONTACT_TO_EMAIL: "shikha@merito.in",
    };
  });

  describe("sendPaymentFailedAlertEmail", () => {
    it("sends an alert to CONTACT_TO_EMAIL with the order details", async () => {
      const { sendPaymentFailedAlertEmail } = await import("../paymentEmails");

      await sendPaymentFailedAlertEmail({ orderId: "order_ABC123", amountPaise: 29900, candidateEmail: "rushi@example.com" });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const call = sendMock.mock.calls[0][0];
      expect(call.to).toEqual(["shikha@merito.in"]);
      expect(call.from).toBe("admin@merito.ai");
      expect(call.subject).toContain("order_ABC123");
      expect(call.text).toContain("order_ABC123");
      expect(call.text).toContain("299.00");
      expect(call.text).toContain("rushi@example.com");
      expect(call.html).toContain("order_ABC123");
    });

    it("throws when CONTACT_TO_EMAIL is missing", async () => {
      delete process.env.CONTACT_TO_EMAIL;
      const { sendPaymentFailedAlertEmail } = await import("../paymentEmails");

      await expect(
        sendPaymentFailedAlertEmail({ orderId: "order_ABC123", amountPaise: 29900, candidateEmail: "rushi@example.com" })
      ).rejects.toThrow("Email service is not configured (CONTACT_TO_EMAIL missing).");
    });

    it("throws when RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;
      const { sendPaymentFailedAlertEmail } = await import("../paymentEmails");

      await expect(
        sendPaymentFailedAlertEmail({ orderId: "order_ABC123", amountPaise: 29900, candidateEmail: "rushi@example.com" })
      ).rejects.toThrow("Email service is not configured (RESEND_API_KEY missing).");
    });
  });
});
