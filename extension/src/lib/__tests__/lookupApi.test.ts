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

  it("posts to the lookup endpoint with the key header, normalized URL, and recruiterEmail", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidateName: "Jane", roles: [] }) });
    const { lookupCandidate } = await importLookupApi();
    await lookupCandidate("https://www.linkedin.com/in/jane-doe", "recruiter@example.com");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.merito.ai/api/public/recruiter-preview/lookup",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-merito-extension-key": "test-key" }),
        body: JSON.stringify({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", recruiterEmail: "recruiter@example.com" }),
      })
    );
  });

  it("flattens the isCurrent role from the server's roles[] response into the render shape", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidateName: "Jane",
        roles: [
          {
            leadId: "lead-1",
            roleTitle: "Data Analyst",
            isCurrent: true,
            candidateLevel: "mid",
            sections: {
              fitment: { report: { overallScore: 82, categories: [], summary: "Good fit" }, matchedAgainstRoleTitle: "Data Analyst" },
            },
          },
          {
            leadId: "lead-2",
            roleTitle: "Software Engineer",
            isCurrent: false,
            candidateLevel: "senior",
            sections: {},
          },
        ],
      }),
    });
    const { lookupCandidate } = await importLookupApi();
    const result = await lookupCandidate("https://www.linkedin.com/in/jane-doe", "recruiter@example.com");
    expect(result).toEqual({
      status: "found",
      data: {
        candidateName: "Jane",
        roleTitle: "Data Analyst",
        candidateLevel: "mid",
        sections: ["fitment"],
        fitment: { report: { overallScore: 82, categories: [], summary: "Good fit" }, matchedAgainstRoleTitle: "Data Analyst" },
        personality: null,
        interview: null,
        references: null,
      },
    });
  });

  it("falls back gracefully when no role has section config (empty roles[])", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidateName: "Jane", roles: [] }) });
    const { lookupCandidate } = await importLookupApi();
    const result = await lookupCandidate("https://www.linkedin.com/in/jane-doe", "recruiter@example.com");
    expect(result).toEqual({
      status: "found",
      data: {
        candidateName: "Jane",
        roleTitle: null,
        candidateLevel: "entry",
        sections: [],
        fitment: null,
        personality: null,
        interview: null,
        references: null,
      },
    });
  });

  it("returns not_found on a 404 response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const { lookupCandidate } = await importLookupApi();
    const result = await lookupCandidate("https://www.linkedin.com/in/jane-doe", "recruiter@example.com");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns verification_required on a 403 response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const { lookupCandidate } = await importLookupApi();
    const result = await lookupCandidate("https://www.linkedin.com/in/jane-doe", "");
    expect(result).toEqual({ status: "verification_required" });
  });

  it("returns error on any other non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const { lookupCandidate } = await importLookupApi();
    const result = await lookupCandidate("https://www.linkedin.com/in/jane-doe", "recruiter@example.com");
    expect(result).toEqual({ status: "error" });
  });

  it("returns error on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { lookupCandidate } = await importLookupApi();
    const result = await lookupCandidate("https://www.linkedin.com/in/jane-doe", "recruiter@example.com");
    expect(result).toEqual({ status: "error" });
  });
});
