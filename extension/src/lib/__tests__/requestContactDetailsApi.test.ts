import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.stubEnv("VITE_RECRUITER_EXTENSION_KEY", "test-key");

async function importModule() {
  return await import("../requestContactDetailsApi");
}

describe("requestContactDetails", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("posts to the request-details endpoint with the key header, linkedinUrl, and recruiterEmail", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ email: "jane@example.com" }) });
    const { requestContactDetails } = await importModule();
    const result = await requestContactDetails("https://www.linkedin.com/in/jane-doe", "recruiter@example.com");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.merito.ai/api/public/recruiter-preview/request-details",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-merito-extension-key": "test-key" }),
        body: JSON.stringify({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", recruiterEmail: "recruiter@example.com" }),
      })
    );
    expect(result).toEqual({ email: "jane@example.com" });
  });

  it("includes leadId in the request body when provided", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ email: "jane@example.com" }) });
    const { requestContactDetails } = await importModule();
    await requestContactDetails("https://www.linkedin.com/in/jane-doe", "recruiter@example.com", "lead-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.merito.ai/api/public/recruiter-preview/request-details",
      expect.objectContaining({
        body: JSON.stringify({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", recruiterEmail: "recruiter@example.com", leadId: "lead-1" }),
      })
    );
  });

  it("omits leadId from the body when it is explicitly null", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ email: "jane@example.com" }) });
    const { requestContactDetails } = await importModule();
    await requestContactDetails("https://www.linkedin.com/in/jane-doe", "recruiter@example.com", null);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.merito.ai/api/public/recruiter-preview/request-details",
      expect.objectContaining({
        body: JSON.stringify({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", recruiterEmail: "recruiter@example.com" }),
      })
    );
  });

  it("returns the server error message on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Please confirm your email first.", verificationRequired: true }) });
    const { requestContactDetails } = await importModule();
    expect(await requestContactDetails("https://www.linkedin.com/in/jane-doe", "recruiter@example.com")).toEqual({
      error: "Please confirm your email first.",
    });
  });

  it("returns null on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { requestContactDetails } = await importModule();
    expect(await requestContactDetails("https://www.linkedin.com/in/jane-doe", "recruiter@example.com")).toBeNull();
  });
});
