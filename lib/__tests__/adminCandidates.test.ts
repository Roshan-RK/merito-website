import { describe, it, expect, vi, beforeEach } from "vitest";

const updateUserByIdMock = vi.fn();
const deleteUserMock = vi.fn();
const generateLinkMock = vi.fn();
const fitmentLeadsSelectMock = vi.fn();
const fitmentLeadsUpdateMock = vi.fn();
const rpcMock = vi.fn();
const logAdminActionMock = vi.fn();
const hubNotificationsInsertMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    auth: { admin: { updateUserById: updateUserByIdMock, deleteUser: deleteUserMock, generateLink: generateLinkMock } },
    from: (table: string) => {
      if (table === "fitment_leads") return { select: fitmentLeadsSelectMock, update: fitmentLeadsUpdateMock };
      if (table === "hub_notifications") return { insert: hubNotificationsInsertMock };
      throw new Error(`Unexpected table in test: ${table}`);
    },
    rpc: rpcMock,
  }),
}));

const getResumeMatchReportMock = vi.fn();
vi.mock("@/lib/intervuebox/reports", () => ({
  getResumeMatchReport: getResumeMatchReportMock,
  scoreOutOfTen: (n: number) => Math.round((n / 100) * 10 * 10) / 10,
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

describe("mergeCandidateAccounts", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: { fitment_leads: 2, report_unlocks: 1, fitment_interviews: 1, personality_tests: 0, reference_checks: 1, report_share_links: 1, contact_detail_requests: 0, recruiter_preview_settings: 1 },
      error: null,
    });
    updateUserByIdMock.mockReset();
    updateUserByIdMock.mockResolvedValue({ error: null });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("runs the merge RPC, bans the merged-away account, and logs row counts", async () => {
    const { mergeCandidateAccounts } = await import("../adminCandidates");

    await mergeCandidateAccounts("user-keep", "user-merge", "rushi.humbe@gmail.com");

    expect(rpcMock).toHaveBeenCalledWith("merge_candidate_accounts", {
      keep_user_id: "user-keep",
      merge_user_id: "user-merge",
    });
    expect(updateUserByIdMock).toHaveBeenCalledWith("user-merge", { ban_duration: "876000h" });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "rushi.humbe@gmail.com",
      action: "candidate.merge",
      targetType: "candidate",
      targetId: "user-keep",
      priorValue: { mergedFrom: "user-merge" },
      newValue: {
        rowsMoved: {
          fitment_leads: 2,
          report_unlocks: 1,
          fitment_interviews: 1,
          personality_tests: 0,
          reference_checks: 1,
          report_share_links: 1,
          contact_detail_requests: 0,
          recruiter_preview_settings: 1,
        },
      },
    });
  });

  it("throws without banning or logging when the RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "db error" } });
    const { mergeCandidateAccounts } = await import("../adminCandidates");

    await expect(mergeCandidateAccounts("user-keep", "user-merge", "rushi.humbe@gmail.com")).rejects.toThrow(
      "Failed to merge accounts: db error"
    );
    expect(updateUserByIdMock).not.toHaveBeenCalled();
    expect(logAdminActionMock).not.toHaveBeenCalled();
  });
});

describe("retryResumeMatch", () => {
  const leadSelectMaybeSingle = vi.fn();
  const leadUpdateEq = vi.fn();

  beforeEach(() => {
    getResumeMatchReportMock.mockReset();
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
    leadSelectMaybeSingle.mockReset();
    leadUpdateEq.mockReset();
    leadUpdateEq.mockResolvedValue({ error: null });
    fitmentLeadsSelectMock.mockReturnValue({ eq: () => ({ maybeSingle: leadSelectMaybeSingle }) });
    fitmentLeadsUpdateMock.mockReturnValue({ eq: leadUpdateEq });
  });

  it("updates the lead when IntervueBox now has a READY result", async () => {
    leadSelectMaybeSingle.mockResolvedValue({
      data: { user_id: "user-1", ib_applied_job_id: "applied-1", resume_match_status: "PENDING" },
      error: null,
    });
    getResumeMatchReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 82,
      rank: "Strong Fit",
      categories: [],
      summary: "Great fit",
      strongPoints: [],
      weakPoints: [],
    });

    const { retryResumeMatch } = await import("../adminCandidates");
    await retryResumeMatch("lead-1", "rushi.humbe@gmail.com");

    expect(leadUpdateEq).toHaveBeenCalledWith("id", "lead-1");
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "candidate.retry_resume_match", targetId: "user-1" })
    );
  });

  it("throws when IntervueBox still hasn't produced a result", async () => {
    leadSelectMaybeSingle.mockResolvedValue({
      data: { user_id: "user-1", ib_applied_job_id: "applied-1", resume_match_status: "PENDING" },
      error: null,
    });
    getResumeMatchReportMock.mockResolvedValue({ status: "PENDING" });

    const { retryResumeMatch } = await import("../adminCandidates");
    await expect(retryResumeMatch("lead-1", "rushi.humbe@gmail.com")).rejects.toThrow(
      "IntervueBox still hasn't produced a result for this candidate."
    );
  });
});

describe("sendCandidateNotification", () => {
  beforeEach(() => {
    hubNotificationsInsertMock.mockReset();
    hubNotificationsInsertMock.mockResolvedValue({ error: null });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("inserts the notification with created_by set and logs the action", async () => {
    const { sendCandidateNotification } = await import("../adminCandidates");

    await sendCandidateNotification("user-1", "Your report is ready.", "rushi.humbe@gmail.com");

    expect(hubNotificationsInsertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      message: "Your report is ready.",
      created_by: "rushi.humbe@gmail.com",
    });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "rushi.humbe@gmail.com",
      action: "candidate.notify",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: null,
      newValue: { message: "Your report is ready." },
    });
  });

  it("throws without logging when the insert fails", async () => {
    hubNotificationsInsertMock.mockResolvedValue({ error: { message: "db error" } });
    const { sendCandidateNotification } = await import("../adminCandidates");

    await expect(sendCandidateNotification("user-1", "hi", "rushi.humbe@gmail.com")).rejects.toThrow(
      "Failed to send notification: db error"
    );
    expect(logAdminActionMock).not.toHaveBeenCalled();
  });
});
