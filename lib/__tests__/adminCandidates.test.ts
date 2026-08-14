import { describe, it, expect, vi, beforeEach } from "vitest";

const updateUserByIdMock = vi.fn();
const logAdminActionMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    auth: { admin: { updateUserById: updateUserByIdMock } },
  }),
}));

vi.mock("@/lib/adminAuditLog", () => ({
  logAdminAction: logAdminActionMock,
}));

describe("banCandidate", () => {
  beforeEach(() => {
    updateUserByIdMock.mockReset();
    updateUserByIdMock.mockResolvedValue({ error: null });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("bans the user for ~100 years and logs the action", async () => {
    const { banCandidate } = await import("../adminCandidates");

    await banCandidate("user-1", "rushi.humbe@gmail.com", "spam signup");

    expect(updateUserByIdMock).toHaveBeenCalledWith("user-1", { ban_duration: "876000h" });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "rushi.humbe@gmail.com",
      action: "candidate.ban",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: null,
      newValue: { banned: true, reason: "spam signup" },
    });
  });

  it("throws when the Admin API call fails", async () => {
    updateUserByIdMock.mockResolvedValue({ error: { message: "user not found" } });
    const { banCandidate } = await import("../adminCandidates");

    await expect(banCandidate("user-1", "rushi.humbe@gmail.com", "spam")).rejects.toThrow(
      "Failed to ban candidate: user not found"
    );
    expect(logAdminActionMock).not.toHaveBeenCalled();
  });
});

describe("unbanCandidate", () => {
  beforeEach(() => {
    updateUserByIdMock.mockReset();
    updateUserByIdMock.mockResolvedValue({ error: null });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("clears the ban and logs the action", async () => {
    const { unbanCandidate } = await import("../adminCandidates");

    await unbanCandidate("user-1", "rushi.humbe@gmail.com");

    expect(updateUserByIdMock).toHaveBeenCalledWith("user-1", { ban_duration: "none" });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "rushi.humbe@gmail.com",
      action: "candidate.unban",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: { banned: true },
      newValue: { banned: false },
    });
  });
});
