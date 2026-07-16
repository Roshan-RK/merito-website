import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn();
const isMock = vi.fn();
const selectMock = vi.fn();
const updateMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: fromMock,
  }),
}));

describe("claimFitmentLeads", () => {
  beforeEach(() => {
    fromMock.mockReset();
    updateMock.mockReset();
    eqMock.mockReset();
    isMock.mockReset();
    selectMock.mockReset();

    // Chain: from("fitment_leads").update({...}).eq("email", ...).is("user_id", null).select("id")
    fromMock.mockReturnValue({ update: updateMock });
    updateMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ is: isMock });
    isMock.mockReturnValue({ select: selectMock });
  });

  it("updates every unclaimed row matching the email and returns the claimed count", async () => {
    selectMock.mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });
    const { claimFitmentLeads } = await import("../claimFitmentLeads");

    const result = await claimFitmentLeads("user-123", "candidate@example.com");

    expect(fromMock).toHaveBeenCalledWith("fitment_leads");
    expect(updateMock).toHaveBeenCalledWith({ user_id: "user-123" });
    expect(eqMock).toHaveBeenCalledWith("email", "candidate@example.com");
    expect(isMock).toHaveBeenCalledWith("user_id", null);
    expect(result).toEqual({ claimedCount: 2 });
  });

  it("returns zero when nothing matches", async () => {
    selectMock.mockResolvedValue({ data: [], error: null });
    const { claimFitmentLeads } = await import("../claimFitmentLeads");

    const result = await claimFitmentLeads("user-123", "nobody@example.com");

    expect(result).toEqual({ claimedCount: 0 });
  });

  it("throws if Supabase returns an error", async () => {
    selectMock.mockResolvedValue({ data: null, error: { message: "db error" } });
    const { claimFitmentLeads } = await import("../claimFitmentLeads");

    await expect(claimFitmentLeads("user-123", "candidate@example.com")).rejects.toThrow();
  });
});
