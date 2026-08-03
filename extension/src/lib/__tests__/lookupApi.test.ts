import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.stubEnv("VITE_RECRUITER_EXTENSION_KEY", "test-key");

async function importLookupApi() {
  return await import("../lookupApi");
}

describe("lookupCandidate", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts to the lookup endpoint with the key header and normalized URL", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ candidateName: "Jane" }) });
    const { lookupCandidate } = await importLookupApi();
    await lookupCandidate("https://www.linkedin.com/in/jane-doe");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.merito.ai/api/public/recruiter-preview/lookup",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-merito-extension-key": "test-key" }),
        body: JSON.stringify({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }),
      })
    );
  });

  it("returns null on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { lookupCandidate } = await importLookupApi();
    const result = await lookupCandidate("https://www.linkedin.com/in/jane-doe");
    expect(result).toBeNull();
  });

  it("returns null on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { lookupCandidate } = await importLookupApi();
    const result = await lookupCandidate("https://www.linkedin.com/in/jane-doe");
    expect(result).toBeNull();
  });
});
