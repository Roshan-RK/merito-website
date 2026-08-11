import { describe, it, expect, vi, beforeEach } from "vitest";

const pdfParseMock = vi.fn();
vi.mock("pdf-parse/lib/pdf-parse.js", () => ({ default: pdfParseMock }));

const extractRawTextMock = vi.fn();
vi.mock("mammoth", () => ({ default: { extractRawText: extractRawTextMock } }));

async function importModule() {
  return await import("../jdFileText");
}

function makeFile(name: string, type: string, content = "x"): File {
  return new File([content], name, { type });
}

describe("isSupportedJdFile", () => {
  it("accepts pdf by mime type", async () => {
    const { isSupportedJdFile } = await importModule();
    expect(isSupportedJdFile(makeFile("jd.pdf", "application/pdf"))).toBe(true);
  });

  it("accepts docx by mime type", async () => {
    const { isSupportedJdFile } = await importModule();
    expect(
      isSupportedJdFile(makeFile("jd.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
    ).toBe(true);
  });

  it("accepts pdf by extension when the browser didn't set a mime type", async () => {
    const { isSupportedJdFile } = await importModule();
    expect(isSupportedJdFile(makeFile("jd.pdf", ""))).toBe(true);
  });

  it("rejects unsupported types", async () => {
    const { isSupportedJdFile } = await importModule();
    expect(isSupportedJdFile(makeFile("jd.txt", "text/plain"))).toBe(false);
  });
});

describe("extractJdText", () => {
  beforeEach(() => {
    pdfParseMock.mockReset();
    extractRawTextMock.mockReset();
  });

  it("extracts and trims text from a PDF", async () => {
    pdfParseMock.mockResolvedValue({ text: "  We need a backend engineer.  " });
    const { extractJdText } = await importModule();
    const text = await extractJdText(makeFile("jd.pdf", "application/pdf"));
    expect(text).toBe("We need a backend engineer.");
    expect(pdfParseMock).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it("extracts and trims text from a DOCX", async () => {
    extractRawTextMock.mockResolvedValue({ value: "  We need a backend engineer.  " });
    const { extractJdText } = await importModule();
    const text = await extractJdText(
      makeFile("jd.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    );
    expect(text).toBe("We need a backend engineer.");
    expect(extractRawTextMock).toHaveBeenCalledWith({ buffer: expect.any(Buffer) });
  });

  it("throws when extraction produces no usable text", async () => {
    pdfParseMock.mockResolvedValue({ text: "   " });
    const { extractJdText } = await importModule();
    await expect(extractJdText(makeFile("jd.pdf", "application/pdf"))).rejects.toThrow(
      "Couldn't extract any text from that file."
    );
  });
});
