import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.stubEnv("VITE_RECRUITER_EXTENSION_KEY", "test-key");

async function importRescoreApi() {
  return await import("../rescoreApi");
}

describe("rescoreCandidate", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts to the rescore endpoint with the key header, url, jdText, and recruiterEmail", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ fitment: null }) });
    const { rescoreCandidate } = await importRescoreApi();
    await rescoreCandidate("https://www.linkedin.com/in/jane-doe", "We need a backend engineer.", "recruiter@example.com");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.merito.ai/api/public/recruiter-preview/rescore",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-merito-extension-key": "test-key" }),
        body: JSON.stringify({
          linkedinUrl: "https://www.linkedin.com/in/jane-doe",
          jdText: "We need a backend engineer.",
          recruiterEmail: "recruiter@example.com",
        }),
      })
    );
  });

  it("returns null on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { rescoreCandidate } = await importRescoreApi();
    const result = await rescoreCandidate("https://www.linkedin.com/in/jane-doe", "JD", "recruiter@example.com");
    expect(result).toBeNull();
  });

  it("returns null on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { rescoreCandidate } = await importRescoreApi();
    const result = await rescoreCandidate("https://www.linkedin.com/in/jane-doe", "JD", "recruiter@example.com");
    expect(result).toBeNull();
  });
});
