import { describe, it, expect } from "vitest";
import { extractPlaceholders, substitutePlaceholders, TEMPLATE_PLACEHOLDERS, TEMPLATE_KEYS } from "../emailTemplates";

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
