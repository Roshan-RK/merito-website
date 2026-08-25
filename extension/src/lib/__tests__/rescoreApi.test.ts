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
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ fitment: { report: { overallScore: 70, categories: [], summary: "" }, matchedAgainstRoleTitle: "Role" } }) });
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

  it("returns ready with the fitment on a successful response", async () => {
    const fitment = { report: { overallScore: 70, categories: [], summary: "" }, matchedAgainstRoleTitle: "Role" };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ fitment }) });
    const { rescoreCandidate } = await importRescoreApi();
    const result = await rescoreCandidate("https://www.linkedin.com/in/jane-doe", "JD", "recruiter@example.com");
    expect(result).toEqual({ status: "ready", fitment });
  });

  it("returns cap_exceeded on a 429 response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ capExceeded: true, error: "Monthly scoring limit reached." }),
    });
    const { rescoreCandidate } = await importRescoreApi();
    const result = await rescoreCandidate("https://www.linkedin.com/in/jane-doe", "JD", "recruiter@example.com");
    expect(result).toEqual({ status: "cap_exceeded" });
  });

  it("returns error on a 429 response without the capExceeded flag", async () => {
    // The per-candidate rate limiter also answers 429 -- that is not the
    // monthly cap, and must not claim the recruiter is out of checks.
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: "Too many requests." }) });
    const { rescoreCandidate } = await importRescoreApi();
    const result = await rescoreCandidate("https://www.linkedin.com/in/jane-doe", "JD", "recruiter@example.com");
    expect(result).toEqual({ status: "error" });
  });

  it("returns verification_required on a 403 response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const { rescoreCandidate } = await importRescoreApi();
    const result = await rescoreCandidate("https://www.linkedin.com/in/jane-doe", "JD", "recruiter@example.com");
    expect(result).toEqual({ status: "verification_required" });
  });

  it("returns error on another non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const { rescoreCandidate } = await importRescoreApi();
    const result = await rescoreCandidate("https://www.linkedin.com/in/jane-doe", "JD", "recruiter@example.com");
    expect(result).toEqual({ status: "error" });
  });

  it("returns error on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { rescoreCandidate } = await importRescoreApi();
    const result = await rescoreCandidate("https://www.linkedin.com/in/jane-doe", "JD", "recruiter@example.com");
    expect(result).toEqual({ status: "error" });
  });
});
