import { describe, it, expect, beforeEach, vi } from "vitest";
import { extractPlaceholders, substitutePlaceholders, TEMPLATE_PLACEHOLDERS, TEMPLATE_KEYS } from "../emailTemplates";

const fromMock = vi.fn();
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from: fromMock }) }));

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
