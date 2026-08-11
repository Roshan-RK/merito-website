import { describe, it, expect, vi, beforeEach } from "vitest";

const maybeSingleMock = vi.fn();
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
  update: () => ({ eq: updateEqMock }),
}));
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from: fromMock }) }));
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.merito.in");

async function importModule() {
  return await import("../prospectShortlist");
}

describe("shortlistProspect", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    updateEqMock.mockClear();
  });

  it("returns null when the prospect doesn't exist", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    const { shortlistProspect } = await importModule();
    expect(await shortlistProspect("missing")).toBeNull();
  });

  it("reuses the existing claim_token if already shortlisted", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { claim_token: "existing-token", candidate_name: "Jane Doe", jd_text: "Backend Engineer role\nMore text" },
    });
    const { shortlistProspect } = await importModule();
    const result = await shortlistProspect("prospect-1");
    expect(result?.claimUrl).toBe("https://www.merito.in/claim/existing-token");
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("generates a new claim_token and marks shortlisted on first call", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { claim_token: null, candidate_name: "Jane Doe", jd_text: "Backend Engineer role" },
    });
    const { shortlistProspect } = await importModule();
    const result = await shortlistProspect("prospect-1");
    expect(result?.claimUrl).toMatch(/^https:\/\/www\.merito\.in\/claim\/[a-f0-9]{64}$/);
    expect(result?.inviteText).toContain("Jane Doe");
    expect(updateEqMock).toHaveBeenCalledWith("id", "prospect-1");
  });
});
