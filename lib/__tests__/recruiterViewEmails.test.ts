import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send: sendMock }; } } ));

const renderTemplateMock = vi.fn();
vi.mock("@/lib/emailTemplates", () => ({ renderTemplate: renderTemplateMock }));

vi.mock("@/lib/site", () => ({ getAbsoluteUrl: (path: string) => `https://www.merito.in${path}` }));

const ORIGINAL_ENV = { ...process.env };

describe("sendRecruiterViewedEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    renderTemplateMock.mockReset();
    renderTemplateMock.mockResolvedValue({ subject: "rendered subject", bodyText: "rendered text", bodyHtml: "rendered html" });
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test", CONTACT_FROM_EMAIL: "admin@merito.ai" };
  });

  it("renders the recruiter_viewed template with the candidate name and dashboard URL", async () => {
    const { sendRecruiterViewedEmail } = await import("../recruiterViewEmails");

    await sendRecruiterViewedEmail("candidate@example.com", "Alex Kumar");

    expect(renderTemplateMock).toHaveBeenCalledWith("recruiter_viewed", { candidateName: "Alex Kumar", dashboardUrl: "https://www.merito.in/hub/account" });
    expect(sendMock).toHaveBeenCalledWith({ from: "admin@merito.ai", to: ["candidate@example.com"], subject: "rendered subject", text: "rendered text", html: "rendered html" });
  });
});
