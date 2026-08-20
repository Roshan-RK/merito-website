import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const updateTemplateMock = vi.fn();
const findMissingPlaceholdersMock = vi.fn();
vi.mock("@/lib/emailTemplates", () => ({
  updateTemplate: updateTemplateMock,
  findMissingPlaceholders: findMissingPlaceholdersMock,
  TEMPLATE_KEYS: ["recruiter_verification", "recruiter_viewed", "payment_failed_alert", "referee_invite", "referee_reminder", "contact_form_submission"],
}));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/email-templates/recruiter_verification", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/admin/email-templates/[key]", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "admin@merito.in" });
    updateTemplateMock.mockReset();
    updateTemplateMock.mockResolvedValue(undefined);
    findMissingPlaceholdersMock.mockReset();
    findMissingPlaceholdersMock.mockReturnValue([]);
  });

  it("saves and returns ok", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(buildRequest({ subject: "s", bodyText: "{{url}}", bodyHtml: "h" }), {
      params: Promise.resolve({ key: "recruiter_verification" }),
    });

    expect(response.status).toBe(200);
    expect(updateTemplateMock).toHaveBeenCalledWith("recruiter_verification", { subject: "s", bodyText: "{{url}}", bodyHtml: "h" }, "admin@merito.in");
  });

  it("returns 404 for an unknown key", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(buildRequest({ subject: "s", bodyText: "t", bodyHtml: "h" }), { params: Promise.resolve({ key: "nonsense" }) });

    expect(response.status).toBe(404);
    expect(updateTemplateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when a required field is missing", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(buildRequest({ subject: "s", bodyHtml: "h" }), { params: Promise.resolve({ key: "recruiter_verification" }) });

    expect(response.status).toBe(400);
    expect(updateTemplateMock).not.toHaveBeenCalled();
  });

  it("returns 400 listing missing placeholders without calling updateTemplate", async () => {
    findMissingPlaceholdersMock.mockReturnValue(["url"]);
    const { PATCH } = await import("../route");

    const response = await PATCH(buildRequest({ subject: "s", bodyText: "t", bodyHtml: "h" }), { params: Promise.resolve({ key: "recruiter_verification" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("url");
    expect(updateTemplateMock).not.toHaveBeenCalled();
  });

  it("returns 500 when updateTemplate throws", async () => {
    updateTemplateMock.mockRejectedValue(new Error("db down"));
    const { PATCH } = await import("../route");

    const response = await PATCH(buildRequest({ subject: "s", bodyText: "t", bodyHtml: "h" }), { params: Promise.resolve({ key: "recruiter_verification" }) });

    expect(response.status).toBe(500);
  });
});
