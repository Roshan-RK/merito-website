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

describe("referenceEmails", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test", CONTACT_FROM_EMAIL: "admin@merito.ai", NEXT_PUBLIC_SITE_URL: "https://www.merito.in" };
  });

  describe("sendRefereeInviteEmail", () => {
    it("sends an email with a feedback link built from the token", async () => {
      const { sendRefereeInviteEmail } = await import("../referenceEmails");

      await sendRefereeInviteEmail({ to: "referee@example.com", refereeName: "Jane Doe", candidateName: "Alex Kumar", token: "abc123" });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const call = sendMock.mock.calls[0][0];
      expect(call.to).toEqual(["referee@example.com"]);
      expect(call.from).toBe("admin@merito.ai");
      expect(call.subject).toContain("Alex Kumar");
      expect(call.html).toContain("https://www.merito.in/hub/references/feedback/abc123");
      expect(call.text).toContain("https://www.merito.in/hub/references/feedback/abc123");
    });

    it("escapes HTML in referee and candidate names", async () => {
      const { sendRefereeInviteEmail } = await import("../referenceEmails");

      await sendRefereeInviteEmail({ to: "referee@example.com", refereeName: "<script>alert(1)</script>", candidateName: "Alex", token: "abc123" });

      const call = sendMock.mock.calls[0][0];
      expect(call.html).not.toContain("<script>");
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
    it("sends a reminder email referencing the same feedback link", async () => {
      const { sendRefereeReminderEmail } = await import("../referenceEmails");

      await sendRefereeReminderEmail({ to: "referee@example.com", refereeName: "Jane Doe", candidateName: "Alex Kumar", token: "abc123" });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const call = sendMock.mock.calls[0][0];
      expect(call.subject.toLowerCase()).toContain("reminder");
      expect(call.html).toContain("https://www.merito.in/hub/references/feedback/abc123");
    });
  });
});
