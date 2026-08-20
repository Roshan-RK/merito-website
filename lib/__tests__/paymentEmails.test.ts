import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send: sendMock }; } } ));

const renderTemplateMock = vi.fn();
vi.mock("@/lib/emailTemplates", () => ({ renderTemplate: renderTemplateMock }));

const ORIGINAL_ENV = { ...process.env };

describe("paymentEmails", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    renderTemplateMock.mockReset();
    renderTemplateMock.mockResolvedValue({ subject: "rendered subject", bodyText: "rendered text", bodyHtml: "rendered html" });
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test", CONTACT_FROM_EMAIL: "admin@merito.ai", CONTACT_TO_EMAIL: "shikha@merito.in" };
  });

  describe("sendPaymentFailedAlertEmail", () => {
    it("renders the payment_failed_alert template with rupee-formatted amount and sends it to CONTACT_TO_EMAIL", async () => {
      const { sendPaymentFailedAlertEmail } = await import("../paymentEmails");

      await sendPaymentFailedAlertEmail({ orderId: "order_ABC123", amountPaise: 29900, candidateEmail: "rushi@example.com" });

      expect(renderTemplateMock).toHaveBeenCalledWith("payment_failed_alert", { orderId: "order_ABC123", amountRupees: "299.00", candidateEmail: "rushi@example.com" });
      expect(sendMock).toHaveBeenCalledWith({ from: "admin@merito.ai", to: ["shikha@merito.in"], subject: "rendered subject", text: "rendered text", html: "rendered html" });
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
