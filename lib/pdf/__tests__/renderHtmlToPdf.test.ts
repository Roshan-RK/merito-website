import { describe, it, expect, vi, beforeEach } from "vitest";

const pdfMock = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
const setContentMock = vi.fn().mockResolvedValue(undefined);
const newPageMock = vi.fn().mockResolvedValue({ setContent: setContentMock, pdf: pdfMock });
const closeMock = vi.fn().mockResolvedValue(undefined);
const launchMock = vi.fn().mockResolvedValue({ newPage: newPageMock, close: closeMock });

vi.mock("puppeteer", () => ({ default: { launch: launchMock } }));

describe("renderHtmlToPdf", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "");
    launchMock.mockClear();
    newPageMock.mockClear();
    setContentMock.mockClear();
    pdfMock.mockClear();
    closeMock.mockClear();
  });

  it("renders the given HTML string to a PDF buffer and closes the browser", async () => {
    const { renderHtmlToPdf } = await import("../renderHtmlToPdf");
    const result = await renderHtmlToPdf("<html><body>hi</body></html>");

    expect(setContentMock).toHaveBeenCalledWith("<html><body>hi</body></html>", { waitUntil: "load" });
    expect(result).toBeInstanceOf(Buffer);
    expect(closeMock).toHaveBeenCalled();
  });
});
