import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const sendTestEmailMock = vi.fn();
vi.mock("@/lib/emailTemplates", () => ({
  sendTestEmail: sendTestEmailMock,
  TEMPLATE_KEYS: ["recruiter_verification", "recruiter_viewed", "payment_failed_alert", "referee_invite", "referee_reminder", "contact_form_submission"],
}));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/email-templates/recruiter_verification/test", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/admin/email-templates/[key]/test", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "admin@merito.in" });
    sendTestEmailMock.mockReset();
    sendTestEmailMock.mockResolvedValue(undefined);
  });

  it("sends the test email and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ subject: "s", bodyText: "t", bodyHtml: "h" }), { params: Promise.resolve({ key: "recruiter_verification" }) });

    expect(response.status).toBe(200);
    expect(sendTestEmailMock).toHaveBeenCalledWith("recruiter_verification", { subject: "s", bodyText: "t", bodyHtml: "h" }, "admin@merito.in");
  });

  it("returns 404 for an unknown key", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ subject: "s", bodyText: "t", bodyHtml: "h" }), { params: Promise.resolve({ key: "nonsense" }) });

    expect(response.status).toBe(404);
  });

  it("returns 400 when a required field is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ subject: "s", bodyHtml: "h" }), { params: Promise.resolve({ key: "recruiter_verification" }) });

    expect(response.status).toBe(400);
  });

  it("returns 502 with the raw provider error when the send fails", async () => {
    sendTestEmailMock.mockRejectedValue(new Error("resend down"));
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ subject: "s", bodyText: "t", bodyHtml: "h" }), { params: Promise.resolve({ key: "recruiter_verification" }) });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("resend down");
  });
});
