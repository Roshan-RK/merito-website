import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send: sendMock }; } } ));

const renderTemplateMock = vi.fn();
vi.mock("@/lib/emailTemplates", () => ({ renderTemplate: renderTemplateMock }));

const ORIGINAL_ENV = { ...process.env };

describe("referenceEmails", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    renderTemplateMock.mockReset();
    renderTemplateMock.mockResolvedValue({ subject: "rendered subject", bodyText: "rendered text", bodyHtml: "rendered html" });
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test", CONTACT_FROM_EMAIL: "admin@merito.ai", NEXT_PUBLIC_SITE_URL: "https://www.merito.in" };
  });

  describe("sendRefereeInviteEmail", () => {
    it("renders the referee_invite template with the feedback link and validity days", async () => {
      const { sendRefereeInviteEmail } = await import("../referenceEmails");

      await sendRefereeInviteEmail({ to: "referee@example.com", refereeName: "Jane Doe", candidateName: "Alex Kumar", token: "abc123" });

      expect(renderTemplateMock).toHaveBeenCalledWith("referee_invite", {
        refereeName: "Jane Doe",
        candidateName: "Alex Kumar",
        url: "https://www.merito.in/hub/references/feedback/abc123",
        validityDays: "14",
      });
      expect(sendMock).toHaveBeenCalledWith({ from: "admin@merito.ai", to: ["referee@example.com"], subject: "rendered subject", text: "rendered text", html: "rendered html" });
    });

    it("uses REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS when set", async () => {
      process.env.REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS = "21";
      const { sendRefereeInviteEmail } = await import("../referenceEmails");

      await sendRefereeInviteEmail({ to: "referee@example.com", refereeName: "Jane", candidateName: "Alex", token: "abc123" });

      expect(renderTemplateMock).toHaveBeenCalledWith("referee_invite", expect.objectContaining({ validityDays: "21" }));
    });

    it("throws when RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;
      const { sendRefereeInviteEmail } = await import("../referenceEmails");

      await expect(
        sendRefereeInviteEmail({ to: "referee@example.com", refereeName: "Jane", candidateName: "Alex", token: "abc123" })
      ).rejects.toThrow();
    });
  });

  describe("sendRefereeReminderEmail", () => {
    it("renders the referee_reminder template with the same feedback link", async () => {
      const { sendRefereeReminderEmail } = await import("../referenceEmails");

      await sendRefereeReminderEmail({ to: "referee@example.com", refereeName: "Jane Doe", candidateName: "Alex Kumar", token: "abc123" });

      expect(renderTemplateMock).toHaveBeenCalledWith("referee_reminder", {
        refereeName: "Jane Doe",
        candidateName: "Alex Kumar",
        url: "https://www.merito.in/hub/references/feedback/abc123",
      });
    });
  });
});
