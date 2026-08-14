import { describe, it, expect, beforeEach, vi } from "vitest";
import { extractPlaceholders, substitutePlaceholders, TEMPLATE_PLACEHOLDERS, TEMPLATE_KEYS } from "../emailTemplates";

const fromMock = vi.fn();
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from: fromMock }) }));

const { logAdminActionMock } = vi.hoisted(() => ({
  logAdminActionMock: vi.fn(),
}));
vi.mock("@/lib/adminAuditLog", () => ({ logAdminAction: logAdminActionMock }));

const sendMock = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send: sendMock }; } }));
const ORIGINAL_ENV = { ...process.env };

describe("listTemplates", () => {
  beforeEach(() => fromMock.mockReset());

  it("returns all rows mapped to camelCase", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [{ key: "recruiter_verification", subject: "s", body_text: "t", body_html: "h", updated_at: "2026-08-14T00:00:00Z", updated_by: "admin@merito.in" }],
      error: null,
    });
    fromMock.mockImplementation(() => ({ select: () => ({ order: orderMock }) }));

    const { listTemplates } = await import("../emailTemplates");
    const result = await listTemplates();

    expect(result).toEqual([
      { key: "recruiter_verification", subject: "s", bodyText: "t", bodyHtml: "h", updatedAt: "2026-08-14T00:00:00Z", updatedBy: "admin@merito.in" },
    ]);
  });

  it("throws when Supabase returns an error", async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "db down" },
    });
    fromMock.mockImplementation(() => ({ select: () => ({ order: orderMock }) }));

    const { listTemplates } = await import("../emailTemplates");
    await expect(listTemplates()).rejects.toThrow("db down");
  });
});

describe("getTemplate", () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.resetModules();
  });

  it("returns the DB row when present", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { subject: "db subject", body_text: "db text", body_html: "db html" }, error: null });
    fromMock.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));

    const { getTemplate } = await import("../emailTemplates");
    const result = await getTemplate("recruiter_verification");

    expect(result.subject).toBe("db subject");
  });

  it("falls back to the compiled-in default when the DB row is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    fromMock.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));

    const { getTemplate, DEFAULT_TEMPLATES } = await import("../emailTemplates");
    const result = await getTemplate("recruiter_verification");

    expect(result).toEqual(DEFAULT_TEMPLATES.recruiter_verification);
  });

  it("does not re-query supabase for the same key within the cache TTL", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { subject: "db subject", body_text: "db text", body_html: "db html" }, error: null });
    fromMock.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));

    const { getTemplate } = await import("../emailTemplates");
    await getTemplate("recruiter_verification");
    await getTemplate("recruiter_verification");

    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("throws when Supabase returns an error", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    fromMock.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));

    const { getTemplate } = await import("../emailTemplates");
    await expect(getTemplate("recruiter_verification")).rejects.toThrow("db down");
  });
});

describe("extractPlaceholders", () => {
  it("returns unique placeholder names found in the text", () => {
    expect(extractPlaceholders("Hi {{name}}, click {{url}} — {{name}} again")).toEqual(["name", "url"]);
  });

  it("returns an empty array when there are none", () => {
    expect(extractPlaceholders("no placeholders here")).toEqual([]);
  });
});

describe("substitutePlaceholders", () => {
  it("substitutes raw values into subject and bodyText", () => {
    const result = substitutePlaceholders(
      { subject: "Hi {{name}}", bodyText: "Link: {{url}}", bodyHtml: "<p>{{url}}</p>" },
      { name: "Alex", url: "https://example.com" }
    );
    expect(result.subject).toBe("Hi Alex");
    expect(result.bodyText).toBe("Link: https://example.com");
  });

  it("HTML-escapes values substituted into bodyHtml", () => {
    const result = substitutePlaceholders(
      { subject: "s", bodyText: "t", bodyHtml: "<p>{{name}}</p>" },
      { name: "<script>alert(1)</script>" }
    );
    expect(result.bodyHtml).not.toContain("<script>");
    expect(result.bodyHtml).toContain("&lt;script&gt;");
  });

  it("converts newlines in a substituted value to <br /> in bodyHtml only", () => {
    const result = substitutePlaceholders(
      { subject: "s", bodyText: "Msg: {{message}}", bodyHtml: "<p>{{message}}</p>" },
      { message: "line one\nline two" }
    );
    expect(result.bodyText).toBe("Msg: line one\nline two");
    expect(result.bodyHtml).toBe("<p>line one<br />line two</p>");
  });

  it("leaves an unmatched placeholder literal in the output", () => {
    const result = substitutePlaceholders({ subject: "Hi {{typo}}", bodyText: "t", bodyHtml: "h" }, {});
    expect(result.subject).toBe("Hi {{typo}}");
  });
});

describe("TEMPLATE_PLACEHOLDERS", () => {
  it("has an entry for every template key", () => {
    for (const key of TEMPLATE_KEYS) {
      expect(TEMPLATE_PLACEHOLDERS[key].length).toBeGreaterThan(0);
    }
  });
});

describe("findMissingPlaceholders", () => {
  it("returns the required placeholders not present anywhere in the draft", async () => {
    const { findMissingPlaceholders } = await import("../emailTemplates");
    const missing = findMissingPlaceholders("referee_invite", { subject: "{{candidateName}}", bodyText: "{{refereeName}} {{url}}", bodyHtml: "h" });
    expect(missing).toEqual(["validityDays"]);
  });

  it("returns an empty array when every required placeholder is present somewhere", async () => {
    const { findMissingPlaceholders } = await import("../emailTemplates");
    const missing = findMissingPlaceholders("recruiter_verification", { subject: "s", bodyText: "{{url}}", bodyHtml: "h" });
    expect(missing).toEqual([]);
  });
});

describe("updateTemplate", () => {
  beforeEach(() => {
    fromMock.mockReset();
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("upserts the row and logs the admin action", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation(() => ({ upsert: upsertMock }));

    const { updateTemplate } = await import("../emailTemplates");
    await updateTemplate("recruiter_verification", { subject: "s", bodyText: "{{url}}", bodyHtml: "h" }, "admin@merito.in");

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: "recruiter_verification", subject: "s", body_text: "{{url}}", body_html: "h", updated_by: "admin@merito.in" })
    );
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ adminEmail: "admin@merito.in", action: "email_template.update", targetType: "email_template", targetId: "recruiter_verification" })
    );
  });

  it("throws when the upsert fails", async () => {
    fromMock.mockImplementation(() => ({ upsert: vi.fn().mockResolvedValue({ error: { message: "db error" } }) }));

    const { updateTemplate } = await import("../emailTemplates");
    await expect(updateTemplate("recruiter_verification", { subject: "s", bodyText: "{{url}}", bodyHtml: "h" }, "admin@merito.in")).rejects.toThrow("db error");
  });
});

describe("renderTemplate", () => {
  beforeEach(() => fromMock.mockReset());

  it("fetches the template for the key and substitutes the given values", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { subject: "Hi {{name}}", body_text: "{{url}}", body_html: "<p>{{url}}</p>" }, error: null });
    fromMock.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));

    const { renderTemplate } = await import("../emailTemplates");
    const result = await renderTemplate("recruiter_verification", { name: "Alex", url: "https://x.test" });

    expect(result).toEqual({ subject: "Hi Alex", bodyText: "https://x.test", bodyHtml: "<p>https://x.test</p>" });
  });
});

describe("sendTestEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test", CONTACT_FROM_EMAIL: "admin@merito.ai" };
  });

  it("sends the rendered draft with sample values to the admin's own email", async () => {
    const { sendTestEmail } = await import("../emailTemplates");

    await sendTestEmail("recruiter_verification", { subject: "Confirm: {{url}}", bodyText: "{{url}}", bodyHtml: "<p>{{url}}</p>" }, "admin@merito.in");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toEqual(["admin@merito.in"]);
    expect(call.from).toBe("admin@merito.ai");
    expect(call.subject).toContain("[TEST]");
    expect(call.text).not.toContain("{{url}}");
  });

  it("leaves an unknown placeholder in the draft visible in the sent email", async () => {
    const { sendTestEmail } = await import("../emailTemplates");

    await sendTestEmail("recruiter_verification", { subject: "s", bodyText: "{{typo}}", bodyHtml: "h" }, "admin@merito.in");

    const call = sendMock.mock.calls[0][0];
    expect(call.text).toContain("{{typo}}");
  });

  it("propagates a Resend send failure", async () => {
    sendMock.mockRejectedValue(new Error("resend down"));
    const { sendTestEmail } = await import("../emailTemplates");

    await expect(sendTestEmail("recruiter_verification", { subject: "s", bodyText: "t", bodyHtml: "h" }, "admin@merito.in")).rejects.toThrow("resend down");
  });
});
