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

  it("returns found with the raw wire payload on a 200 response (no flattening)", async () => {
    const wire = { candidateName: "Jane", roles: [{ leadId: "lead-1", roleTitle: "Data Analyst", isCurrent: true, candidateLevel: "mid", sections: {} }] };
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => wire });
    const { lookupCandidate } = await importLookupApi();
    const result = await lookupCandidate("https://www.linkedin.com/in/jane-doe", "recruiter@example.com");
    expect(result).toEqual({ status: "found", data: wire });
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

describe("flattenLookupRole", () => {
  const wire = {
    candidateName: "Jane",
    roles: [
      {
        leadId: "lead-1",
        roleTitle: "Data Analyst",
        isCurrent: true,
        candidateLevel: "mid" as const,
        sections: { fitment: { report: { overallScore: 82, categories: [], summary: "Good fit" }, matchedAgainstRoleTitle: "Data Analyst" } },
      },
      {
        leadId: "lead-2",
        roleTitle: "Software Engineer",
        isCurrent: false,
        candidateLevel: "senior" as const,
        sections: {},
      },
    ],
  };

  it("picks the role matching the given leadId", async () => {
    const { flattenLookupRole } = await importLookupApi();
    const result = flattenLookupRole(wire, "lead-2");
    expect(result).toEqual({
      candidateName: "Jane",
      roleTitle: "Software Engineer",
      candidateLevel: "senior",
      sections: [],
      fitment: null,
      personality: null,
      interview: null,
      references: null,
    });
  });

  it("falls back to isCurrent when leadId doesn't match any role", async () => {
    const { flattenLookupRole } = await importLookupApi();
    const result = flattenLookupRole(wire, "lead-does-not-exist");
    expect(result.roleTitle).toBe("Data Analyst");
    expect(result.fitment).toEqual({ report: { overallScore: 82, categories: [], summary: "Good fit" }, matchedAgainstRoleTitle: "Data Analyst" });
  });

  it("falls back to isCurrent when leadId is omitted", async () => {
    const { flattenLookupRole } = await importLookupApi();
    const result = flattenLookupRole(wire);
    expect(result.roleTitle).toBe("Data Analyst");
  });

  it("falls back to the first role when there's no isCurrent and no matching leadId", async () => {
    const { flattenLookupRole } = await importLookupApi();
    const noCurrentWire = { candidateName: "Jane", roles: [{ ...wire.roles[1], isCurrent: false }] };
    const result = flattenLookupRole(noCurrentWire, "nope");
    expect(result.roleTitle).toBe("Software Engineer");
  });

  it("returns an empty/default shape when roles[] is empty", async () => {
    const { flattenLookupRole } = await importLookupApi();
    const result = flattenLookupRole({ candidateName: "Jane", roles: [] });
    expect(result).toEqual({
      candidateName: "Jane",
      roleTitle: null,
      candidateLevel: "entry",
      sections: [],
      fitment: null,
      personality: null,
      interview: null,
      references: null,
    });
  });
});
