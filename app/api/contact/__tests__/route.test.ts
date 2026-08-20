import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send: sendMock }; } } ));

const renderTemplateMock = vi.fn();
vi.mock("@/lib/emailTemplates", () => ({ renderTemplate: renderTemplateMock }));

vi.mock("@/lib/recaptcha", () => ({ verifyRecaptchaToken: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/rateLimit", () => ({ createRateLimiter: () => () => true }));

const ORIGINAL_ENV = { ...process.env };

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/contact", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    renderTemplateMock.mockReset();
    renderTemplateMock.mockResolvedValue({ subject: "rendered subject", bodyText: "rendered text", bodyHtml: "rendered html" });
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test", CONTACT_FROM_EMAIL: "admin@merito.ai", CONTACT_TO_EMAIL: "ops@merito.in" };
    delete process.env.RECAPTCHA_SECRET_KEY;
  });

  it("renders the contact_form_submission template and sends it", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      buildRequest({ firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: "9999999999", departments: "Sales", message: "Hi there" })
    );

    expect(response.status).toBe(200);
    expect(renderTemplateMock).toHaveBeenCalledWith("contact_form_submission", {
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: "9999999999",
      departments: "Sales",
      message: "Hi there",
    });
    expect(sendMock).toHaveBeenCalledWith({
      from: "admin@merito.ai",
      to: ["ops@merito.in"],
      replyTo: "jane@example.com",
      subject: "rendered subject",
      text: "rendered text",
      html: "rendered html",
    });
  });

  it("substitutes 'Not provided' when phone is blank", async () => {
    const { POST } = await import("../route");

    await POST(buildRequest({ firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: "", departments: "Sales", message: "Hi" }));

    expect(renderTemplateMock).toHaveBeenCalledWith("contact_form_submission", expect.objectContaining({ phone: "Not provided" }));
  });

  it("returns 400 when a required field is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ firstName: "Jane", email: "jane@example.com", departments: "Sales", message: "Hi" }));

    expect(response.status).toBe(400);
    expect(renderTemplateMock).not.toHaveBeenCalled();
  });
});
