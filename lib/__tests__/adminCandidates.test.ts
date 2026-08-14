import { describe, it, expect, vi, beforeEach } from "vitest";

const updateUserByIdMock = vi.fn();
const deleteUserMock = vi.fn();
const generateLinkMock = vi.fn();
const fitmentLeadsSelectMock = vi.fn();
const logAdminActionMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    auth: { admin: { updateUserById: updateUserByIdMock, deleteUser: deleteUserMock, generateLink: generateLinkMock } },
    from: (table: string) => {
      if (table === "fitment_leads") return { select: fitmentLeadsSelectMock };
      throw new Error(`Unexpected table in test: ${table}`);
    },
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

describe("deleteCandidate", () => {
  beforeEach(() => {
    deleteUserMock.mockReset();
    deleteUserMock.mockResolvedValue({ error: null });
    fitmentLeadsSelectMock.mockReset();
    fitmentLeadsSelectMock.mockReturnValue({
      eq: () =>
        Promise.resolve({
          data: [{ id: "lead-1", role_title: "Senior Product Manager", email: "candidate@example.com" }],
        }),
    });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("snapshots the lead rows, deletes the auth user, and logs the action", async () => {
    const { deleteCandidate } = await import("../adminCandidates");

    await deleteCandidate("user-1", "rushi.humbe@gmail.com");

    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "rushi.humbe@gmail.com",
      action: "candidate.delete",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: { leads: [{ id: "lead-1", role_title: "Senior Product Manager", email: "candidate@example.com" }] },
      newValue: null,
    });
  });

  it("throws when the Admin API delete fails", async () => {
    deleteUserMock.mockResolvedValue({ error: { message: "user not found" } });
    const { deleteCandidate } = await import("../adminCandidates");

    await expect(deleteCandidate("user-1", "rushi.humbe@gmail.com")).rejects.toThrow(
      "Failed to delete candidate: user not found"
    );
    expect(logAdminActionMock).not.toHaveBeenCalled();
  });
});

describe("generateCandidateMagicLink", () => {
  beforeEach(() => {
    generateLinkMock.mockReset();
    generateLinkMock.mockResolvedValue({
      data: { properties: { action_link: "https://example.com/magic?token=abc123" } },
      error: null,
    });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("generates a magic link and logs that a link was generated (not the link itself)", async () => {
    const { generateCandidateMagicLink } = await import("../adminCandidates");

    const link = await generateCandidateMagicLink("candidate@example.com", "rushi.humbe@gmail.com");

    expect(link).toBe("https://example.com/magic?token=abc123");
    expect(generateLinkMock).toHaveBeenCalledWith({ type: "magiclink", email: "candidate@example.com" });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "rushi.humbe@gmail.com",
      action: "candidate.magic_link_generated",
      targetType: "candidate",
      targetId: "candidate@example.com",
      priorValue: null,
      newValue: { linkGenerated: true },
    });
  });

  it("throws when the Admin API call fails", async () => {
    generateLinkMock.mockResolvedValue({ data: null, error: { message: "invalid email" } });
    const { generateCandidateMagicLink } = await import("../adminCandidates");

    await expect(generateCandidateMagicLink("bad@example.com", "rushi.humbe@gmail.com")).rejects.toThrow(
      "Failed to generate magic link: invalid email"
    );
  });
});
