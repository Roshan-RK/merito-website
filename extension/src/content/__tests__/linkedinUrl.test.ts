import { describe, it, expect } from "vitest";
import { LINKEDIN_URL_PATTERN, normalizeLinkedinUrl } from "../linkedinUrl";

describe("normalizeLinkedinUrl", () => {
  it("strips a trailing query string", () => {
    expect(normalizeLinkedinUrl("https://www.linkedin.com/in/jane-doe?originalSubdomain=in")).toBe(
      "https://www.linkedin.com/in/jane-doe"
    );
  });

  it("strips a trailing hash fragment", () => {
    expect(normalizeLinkedinUrl("https://www.linkedin.com/in/jane-doe#experience")).toBe(
      "https://www.linkedin.com/in/jane-doe"
    );
  });

  it("strips a trailing slash", () => {
    expect(normalizeLinkedinUrl("https://www.linkedin.com/in/jane-doe/")).toBe(
      "https://www.linkedin.com/in/jane-doe"
    );
  });

  it("leaves an already-normalized URL unchanged", () => {
    expect(normalizeLinkedinUrl("https://www.linkedin.com/in/jane-doe")).toBe(
      "https://www.linkedin.com/in/jane-doe"
    );
  });
});

describe("LINKEDIN_URL_PATTERN", () => {
  it("accepts a normalized www LinkedIn profile URL", () => {
    expect(LINKEDIN_URL_PATTERN.test("https://www.linkedin.com/in/jane-doe")).toBe(true);
  });

  it("rejects a non-LinkedIn domain", () => {
    expect(LINKEDIN_URL_PATTERN.test("https://example.com/in/jane-doe")).toBe(false);
  });

  it("rejects a LinkedIn URL missing /in/", () => {
    expect(LINKEDIN_URL_PATTERN.test("https://www.linkedin.com/jane-doe")).toBe(false);
  });
});
