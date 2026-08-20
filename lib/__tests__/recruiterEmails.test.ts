import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send: sendMock }; } } ));

const renderTemplateMock = vi.fn();
vi.mock("@/lib/emailTemplates", () => ({ renderTemplate: renderTemplateMock }));

const ORIGINAL_ENV = { ...process.env };

describe("sendRecruiterVerificationEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    renderTemplateMock.mockReset();
    renderTemplateMock.mockResolvedValue({ subject: "rendered subject", bodyText: "rendered text", bodyHtml: "rendered html" });
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test", CONTACT_FROM_EMAIL: "admin@merito.ai", NEXT_PUBLIC_SITE_URL: "https://www.merito.in" };
  });

  it("renders the recruiter_verification template with the confirm URL and sends it", async () => {
    const { sendRecruiterVerificationEmail } = await import("../recruiterEmails");

    await sendRecruiterVerificationEmail("recruiter@company.com", "tok_123");

    expect(renderTemplateMock).toHaveBeenCalledWith("recruiter_verification", {
      url: "https://www.merito.in/api/public/recruiter/verify-email/confirm?token=tok_123",
    });
    expect(sendMock).toHaveBeenCalledWith({
      from: "admin@merito.ai",
      to: ["recruiter@company.com"],
      subject: "rendered subject",
      text: "rendered text",
      html: "rendered html",
    });
  });
});
