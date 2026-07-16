import { describe, it, expect, vi, beforeEach } from "vitest";

const ilikeMock = vi.fn();
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
    ilikeMock.mockReset();
    isMock.mockReset();
    selectMock.mockReset();

    // Chain: from("fitment_leads").update({...}).ilike("email", ...).is("user_id", null).select("id")
    fromMock.mockReturnValue({ update: updateMock });
    updateMock.mockReturnValue({ ilike: ilikeMock });
    ilikeMock.mockReturnValue({ is: isMock });
    isMock.mockReturnValue({ select: selectMock });
  });

  it("updates every unclaimed row matching the email and returns the claimed count", async () => {
    selectMock.mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });
    const { claimFitmentLeads } = await import("../claimFitmentLeads");

    const result = await claimFitmentLeads("user-123", "candidate@example.com");

    expect(fromMock).toHaveBeenCalledWith("fitment_leads");
    expect(updateMock).toHaveBeenCalledWith({ user_id: "user-123" });
    expect(ilikeMock).toHaveBeenCalledWith("email", "candidate@example.com");
    expect(isMock).toHaveBeenCalledWith("user_id", null);
    expect(result).toEqual({ claimedCount: 2 });
  });

  it("uses case-insensitive match so a differently-cased stored email is still claimed", async () => {
    selectMock.mockResolvedValue({ data: [{ id: "a" }], error: null });
    const { claimFitmentLeads } = await import("../claimFitmentLeads");

    await claimFitmentLeads("user-123", "John.Doe@Gmail.com");

    expect(ilikeMock).toHaveBeenCalledWith("email", "John.Doe@Gmail.com");
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
