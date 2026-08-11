import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.stubEnv("VITE_RECRUITER_EXTENSION_KEY", "test-key");

async function importModule() {
  return await import("../extractJdTextApi");
}

function makeFile(): File {
  return new File(["content"], "jd.pdf", { type: "application/pdf" });
}

describe("extractJdTextFromFile", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts the file as FormData with the key header, no manual Content-Type", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ jdText: "We need a backend engineer." }) });
    const { extractJdTextFromFile } = await importModule();
    const result = await extractJdTextFromFile(makeFile());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.merito.ai/api/public/recruiter-preview/extract-jd-text",
      expect.objectContaining({
        method: "POST",
        headers: { "x-merito-extension-key": "test-key" },
        body: expect.any(FormData),
      })
    );
    expect(result).toEqual({ jdText: "We need a backend engineer." });
  });

  it("returns the server error message on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Unsupported file type." }) });
    const { extractJdTextFromFile } = await importModule();
    expect(await extractJdTextFromFile(makeFile())).toEqual({ error: "Unsupported file type." });
  });

  it("returns a generic error on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { extractJdTextFromFile } = await importModule();
    expect(await extractJdTextFromFile(makeFile())).toEqual({
      error: "Couldn't read that file — try pasting the JD instead.",
    });
  });
});
