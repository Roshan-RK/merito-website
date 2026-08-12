import { describe, it, expect, vi } from "vitest";

const renderMock = vi.fn().mockResolvedValue(Buffer.from("pdf-bytes"));
vi.mock("@/lib/pdf/renderHtmlToPdf", () => ({ renderHtmlToPdf: renderMock }));

const FIELDS = {
  name: "Jane Doe",
  headline: "Senior Backend Engineer",
  experience: [{ title: "Backend Engineer", company: "Acme <Corp>", duration: "2020 - Present", description: "Built APIs" }],
  education: [{ school: "MIT", degree: "B.S. Computer Science", duration: "2016 - 2020" }],
  skills: ["Node.js", "PostgreSQL"],
};

describe("buildResumeHtml", () => {
  it("includes candidate name, experience, education, and skills", async () => {
    const { buildResumeHtml } = await import("../syntheticResume");
    const html = buildResumeHtml(FIELDS);
    expect(html).toContain("Jane Doe");
    expect(html).toContain("Backend Engineer");
    expect(html).toContain("MIT");
    expect(html).toContain("Node.js");
  });

  it("escapes HTML-unsafe characters in scraped fields", async () => {
    const { buildResumeHtml } = await import("../syntheticResume");
    const html = buildResumeHtml(FIELDS);
    expect(html).not.toContain("Acme <Corp>");
    expect(html).toContain("Acme &lt;Corp&gt;");
  });
});

describe("buildResumeText", () => {
  it("includes candidate name, experience, education, and skills as plain text", async () => {
    const { buildResumeText } = await import("../syntheticResume");
    const text = buildResumeText(FIELDS);
    expect(text).toContain("Jane Doe");
    expect(text).toContain("Backend Engineer — Acme <Corp>");
    expect(text).toContain("Built APIs");
    expect(text).toContain("MIT");
    expect(text).toContain("Node.js, PostgreSQL");
  });
});

describe("buildSyntheticResumePdf", () => {
  it("renders the built HTML via renderHtmlToPdf", async () => {
    const { buildSyntheticResumePdf } = await import("../syntheticResume");
    const result = await buildSyntheticResumePdf(FIELDS);
    expect(renderMock).toHaveBeenCalledWith(expect.stringContaining("Jane Doe"));
    expect(result.toString()).toBe("pdf-bytes");
  });
});
