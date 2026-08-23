import { describe, it, expect, vi, beforeEach } from "vitest";

const updateUserByIdMock = vi.fn();
const deleteUserMock = vi.fn();
const generateLinkMock = vi.fn();
const listUsersMock = vi.fn();
const fitmentLeadsSelectMock = vi.fn();
const fitmentLeadsUpdateMock = vi.fn();
const reportUnlocksSelectMock = vi.fn();
const fitmentInterviewsSelectMock = vi.fn();
const fitmentInterviewsUpdateMock = vi.fn();
const personalityTestsSelectMock = vi.fn();
const referenceChecksSelectMock = vi.fn();
const rpcMock = vi.fn();
const logAdminActionMock = vi.fn();
const hubNotificationsInsertMock = vi.fn();
const candidateDeletionsInsertMock = vi.fn();
const candidateDeletionsDeleteMock = vi.fn();
const candidateDeletionsSelectMock = vi.fn();
const recruiterPreviewSelectMock = vi.fn();
const recruiterPreviewUpsertMock = vi.fn();
const profileOverrideSelectMock = vi.fn();
const profileOverrideUpsertMock = vi.fn();
const reportShareLinksSelectMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    auth: { admin: { updateUserById: updateUserByIdMock, deleteUser: deleteUserMock, generateLink: generateLinkMock, listUsers: listUsersMock } },
    from: (table: string) => {
      if (table === "fitment_leads") return { select: fitmentLeadsSelectMock, update: fitmentLeadsUpdateMock };
      if (table === "report_unlocks") return { select: reportUnlocksSelectMock };
      if (table === "fitment_interviews") return { select: fitmentInterviewsSelectMock, update: fitmentInterviewsUpdateMock };
      if (table === "personality_tests") return { select: personalityTestsSelectMock };
      if (table === "reference_checks") return { select: referenceChecksSelectMock };
      if (table === "hub_notifications") return { insert: hubNotificationsInsertMock };
      if (table === "candidate_deletions") return { select: candidateDeletionsSelectMock, insert: candidateDeletionsInsertMock, delete: candidateDeletionsDeleteMock };
      if (table === "recruiter_preview_settings") return { select: recruiterPreviewSelectMock, upsert: recruiterPreviewUpsertMock };
      if (table === "candidate_profile_overrides") return { select: profileOverrideSelectMock, upsert: profileOverrideUpsertMock };
      if (table === "report_share_links") return { select: reportShareLinksSelectMock };
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

const getInterviewReportMock = vi.fn();
vi.mock("@/lib/intervuebox/interviewReports", () => ({
  getInterviewReport: getInterviewReportMock,
}));

const listActionsForTargetMock = vi.fn();
vi.mock("@/lib/adminAuditLog", () => ({
  logAdminAction: logAdminActionMock,
  listActionsForTarget: listActionsForTargetMock,
}));

const getReferenceCheckStatusMock = vi.fn();
const computeReferenceReportMock = vi.fn();
const listRefereeOverrideHistoryMock = vi.fn();
vi.mock("@/lib/referenceChecks", () => ({
  getReferenceCheckStatus: getReferenceCheckStatusMock,
  computeReferenceReport: computeReferenceReportMock,
  listRefereeOverrideHistory: listRefereeOverrideHistoryMock,
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

    await banCandidate("user-1", "roshan@merito.in", "spam signup");

    expect(updateUserByIdMock).toHaveBeenCalledWith("user-1", { ban_duration: "876000h" });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
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

    await expect(banCandidate("user-1", "roshan@merito.in", "spam")).rejects.toThrow(
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

    await unbanCandidate("user-1", "roshan@merito.in");

    expect(updateUserByIdMock).toHaveBeenCalledWith("user-1", { ban_duration: "none" });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
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
    updateUserByIdMock.mockReset();
    updateUserByIdMock.mockResolvedValue({ error: null });
    fitmentLeadsSelectMock.mockReset();
    fitmentLeadsSelectMock.mockReturnValue({
      eq: () =>
        Promise.resolve({
          data: [{ id: "lead-1", role_title: "Senior Product Manager", email: "candidate@example.com" }],
        }),
    });
    candidateDeletionsInsertMock.mockReset();
    candidateDeletionsInsertMock.mockResolvedValue({ error: null });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("soft-deletes: bans the user, records a purge_after date, and logs the action (does not hard-delete)", async () => {
    const { deleteCandidate } = await import("../adminCandidates");

    await deleteCandidate("user-1", "roshan@merito.in");

    expect(updateUserByIdMock).toHaveBeenCalledWith("user-1", { ban_duration: "876000h" });
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(candidateDeletionsInsertMock).toHaveBeenCalledTimes(1);
    const insertedRow = candidateDeletionsInsertMock.mock.calls[0][0];
    expect(insertedRow.user_id).toBe("user-1");
    expect(insertedRow.requested_by).toBe("roshan@merito.in");
    expect(new Date(insertedRow.purge_after).getTime()).toBeGreaterThan(Date.now());

    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "candidate.soft_delete",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: { leads: [{ id: "lead-1", role_title: "Senior Product Manager", email: "candidate@example.com" }] },
      newValue: { pendingDeletion: true, purgeAfter: insertedRow.purge_after },
    });
  });

  it("throws when the ban call fails, and never inserts a deletion record", async () => {
    updateUserByIdMock.mockResolvedValue({ error: { message: "user not found" } });
    const { deleteCandidate } = await import("../adminCandidates");

    await expect(deleteCandidate("user-1", "roshan@merito.in")).rejects.toThrow(
      "Failed to delete candidate: user not found"
    );
    expect(candidateDeletionsInsertMock).not.toHaveBeenCalled();
    expect(logAdminActionMock).not.toHaveBeenCalled();
  });

  it("throws when recording the deletion fails, after the ban already succeeded", async () => {
    candidateDeletionsInsertMock.mockResolvedValue({ error: { message: "constraint violation" } });
    const { deleteCandidate } = await import("../adminCandidates");

    await expect(deleteCandidate("user-1", "roshan@merito.in")).rejects.toThrow(
      "Failed to delete candidate: constraint violation"
    );
    expect(logAdminActionMock).not.toHaveBeenCalled();
  });
});

describe("restoreCandidate", () => {
  beforeEach(() => {
    updateUserByIdMock.mockReset();
    updateUserByIdMock.mockResolvedValue({ error: null });
    candidateDeletionsDeleteMock.mockReset();
    candidateDeletionsDeleteMock.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("clears the ban, removes the deletion record, and logs the action", async () => {
    const { restoreCandidate } = await import("../adminCandidates");

    await restoreCandidate("user-1", "roshan@merito.in");

    expect(updateUserByIdMock).toHaveBeenCalledWith("user-1", { ban_duration: "none" });
    expect(candidateDeletionsDeleteMock).toHaveBeenCalledTimes(1);
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "candidate.restore",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: { pendingDeletion: true },
      newValue: { pendingDeletion: false },
    });
  });

  it("throws when the unban call fails", async () => {
    updateUserByIdMock.mockResolvedValue({ error: { message: "user not found" } });
    const { restoreCandidate } = await import("../adminCandidates");

    await expect(restoreCandidate("user-1", "roshan@merito.in")).rejects.toThrow(
      "Failed to restore candidate: user not found"
    );
    expect(candidateDeletionsDeleteMock).not.toHaveBeenCalled();
    expect(logAdminActionMock).not.toHaveBeenCalled();
  });
});

describe("generateCandidateMagicLink", () => {
  beforeEach(() => {
    generateLinkMock.mockReset();
    generateLinkMock.mockResolvedValue({
      data: { properties: { action_link: "https://example.com/magic?token=abc123", hashed_token: "hashed-abc123" } },
      error: null,
    });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("generates a magic link through our own callback route (not Supabase's raw action_link) and logs that a link was generated (not the link itself)", async () => {
    const { generateCandidateMagicLink } = await import("../adminCandidates");

    const link = await generateCandidateMagicLink("candidate@example.com", "roshan@merito.in");

    expect(link).toBe("https://www.merito.ai/hub/auth/callback?token_hash=hashed-abc123&type=magiclink");
    expect(generateLinkMock).toHaveBeenCalledWith({ type: "magiclink", email: "candidate@example.com" });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
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

    await expect(generateCandidateMagicLink("bad@example.com", "roshan@merito.in")).rejects.toThrow(
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

    await mergeCandidateAccounts("user-keep", "user-merge", "roshan@merito.in");

    expect(rpcMock).toHaveBeenCalledWith("merge_candidate_accounts", {
      keep_user_id: "user-keep",
      merge_user_id: "user-merge",
    });
    expect(updateUserByIdMock).toHaveBeenCalledWith("user-merge", { ban_duration: "876000h" });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
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

    await expect(mergeCandidateAccounts("user-keep", "user-merge", "roshan@merito.in")).rejects.toThrow(
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
    await retryResumeMatch("lead-1", "roshan@merito.in");

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
    await expect(retryResumeMatch("lead-1", "roshan@merito.in")).rejects.toThrow(
      "IntervueBox still hasn't produced a result for this candidate."
    );
  });

  it("refuses to retry when the lead's fitment report was manually overridden", async () => {
    leadSelectMaybeSingle.mockResolvedValue({
      data: { user_id: "user-1", ib_applied_job_id: "applied-1", resume_match_status: "READY", resume_match_overridden: true },
      error: null,
    });

    const { retryResumeMatch } = await import("../adminCandidates");
    await expect(retryResumeMatch("lead-1", "roshan@merito.in")).rejects.toThrow(/manually overridden/);
    expect(getResumeMatchReportMock).not.toHaveBeenCalled();
  });
});

describe("overrideFitmentReport", () => {
  const leadSelectMaybeSingle = vi.fn();
  const leadUpdateEq = vi.fn();

  beforeEach(() => {
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
    leadSelectMaybeSingle.mockReset();
    leadUpdateEq.mockReset();
    leadUpdateEq.mockResolvedValue({ error: null });
    fitmentLeadsSelectMock.mockReset();
    fitmentLeadsSelectMock.mockReturnValue({ eq: () => ({ maybeSingle: leadSelectMaybeSingle }) });
    fitmentLeadsUpdateMock.mockReset();
    fitmentLeadsUpdateMock.mockReturnValue({ eq: leadUpdateEq });
  });

  it("merges the override into resume_match_raw and logs prior/new values", async () => {
    leadSelectMaybeSingle.mockResolvedValue({
      data: {
        user_id: "user-1",
        resume_match_status: "READY",
        resume_match_raw: { overallScore: 60, rank: "Fit", categories: [], summary: "Old summary", strongPoints: [], weakPoints: [] },
      },
      error: null,
    });

    const { overrideFitmentReport } = await import("../adminCandidates");
    await overrideFitmentReport("lead-1", { overallScore: 90, summary: "Better summary" }, "roshan@merito.in", "resume was misparsed");

    expect(leadUpdateEq).toHaveBeenCalledWith("id", "lead-1");
    expect(fitmentLeadsUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resume_match_raw: expect.objectContaining({ overallScore: 90, summary: "Better summary", rank: "Fit" }),
        resume_match_overridden: true,
      })
    );
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "candidate.fitment_override",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: { overallScore: 60, summary: "Old summary" },
      newValue: { leadId: "lead-1", overallScore: 90, summary: "Better summary", reason: "resume was misparsed" },
    });
  });

  it("throws when the report isn't ready yet", async () => {
    leadSelectMaybeSingle.mockResolvedValue({ data: { user_id: "user-1", resume_match_status: "PENDING" }, error: null });

    const { overrideFitmentReport } = await import("../adminCandidates");
    await expect(
      overrideFitmentReport("lead-1", { overallScore: 90, summary: "x" }, "roshan@merito.in", "x")
    ).rejects.toThrow(/isn't ready/);
    expect(fitmentLeadsUpdateMock).not.toHaveBeenCalled();
  });

  it("throws on an out-of-range score", async () => {
    const { overrideFitmentReport } = await import("../adminCandidates");
    await expect(
      overrideFitmentReport("lead-1", { overallScore: 150, summary: "x" }, "roshan@merito.in", "x")
    ).rejects.toThrow(/between 0 and 100/);
    expect(leadSelectMaybeSingle).not.toHaveBeenCalled();
  });
});

describe("clearFitmentOverride", () => {
  const leadSelectMaybeSingle = vi.fn();
  const leadUpdateEq = vi.fn();

  beforeEach(() => {
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
    leadSelectMaybeSingle.mockReset();
    leadUpdateEq.mockReset();
    leadUpdateEq.mockResolvedValue({ error: null });
    fitmentLeadsSelectMock.mockReset();
    fitmentLeadsSelectMock.mockReturnValue({ eq: () => ({ maybeSingle: leadSelectMaybeSingle }) });
    fitmentLeadsUpdateMock.mockReset();
    fitmentLeadsUpdateMock.mockReturnValue({ eq: leadUpdateEq });
  });

  it("resets the flag and logs the reason", async () => {
    leadSelectMaybeSingle.mockResolvedValue({ data: { user_id: "user-1" }, error: null });

    const { clearFitmentOverride } = await import("../adminCandidates");
    await clearFitmentOverride("lead-1", "roshan@merito.in", "resync needed");

    expect(fitmentLeadsUpdateMock).toHaveBeenCalledWith({ resume_match_overridden: false });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "candidate.fitment_override_cleared",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: { overridden: true },
      newValue: { leadId: "lead-1", overridden: false, reason: "resync needed" },
    });
  });

  it("throws when the lead doesn't exist", async () => {
    leadSelectMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { clearFitmentOverride } = await import("../adminCandidates");
    await expect(clearFitmentOverride("lead-1", "roshan@merito.in", "x")).rejects.toThrow("Lead not found.");
    expect(fitmentLeadsUpdateMock).not.toHaveBeenCalled();
  });
});

describe("sendCandidateNotification", () => {
  beforeEach(() => {
    hubNotificationsInsertMock.mockReset();
    hubNotificationsInsertMock.mockResolvedValue({ error: null });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("inserts the notification with created_by set, category defaulted to general, and logs the action", async () => {
    const { sendCandidateNotification } = await import("../adminCandidates");

    await sendCandidateNotification("user-1", "Your report is ready.", "roshan@merito.in");

    expect(hubNotificationsInsertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      message: "Your report is ready.",
      category: "general",
      created_by: "roshan@merito.in",
    });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "candidate.notify",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: null,
      newValue: { message: "Your report is ready.", category: "general" },
    });
  });

  it("inserts the notification with an explicit category when given", async () => {
    const { sendCandidateNotification } = await import("../adminCandidates");

    await sendCandidateNotification("user-1", "Payment received.", "roshan@merito.in", "payment");

    expect(hubNotificationsInsertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      message: "Payment received.",
      category: "payment",
      created_by: "roshan@merito.in",
    });
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: { message: "Payment received.", category: "payment" } })
    );
  });

  it("throws without logging when the insert fails", async () => {
    hubNotificationsInsertMock.mockResolvedValue({ error: { message: "db error" } });
    const { sendCandidateNotification } = await import("../adminCandidates");

    await expect(sendCandidateNotification("user-1", "hi", "roshan@merito.in")).rejects.toThrow(
      "Failed to send notification: db error"
    );
    expect(logAdminActionMock).not.toHaveBeenCalled();
  });
});

describe("listCandidates", () => {
  const fitmentInterviewsEq = vi.fn();
  const referenceChecksEq = vi.fn();

  function stubCandidates(count: number) {
    fitmentLeadsSelectMock.mockReturnValue({
      order: () =>
        Promise.resolve({
          data: Array.from({ length: count }, (_, i) => ({
            user_id: `user-${i}`,
            email: `user${i}@example.com`,
            name: `User ${i}`,
            role_title: "Product Manager",
            created_at: new Date(2026, 0, i + 1).toISOString(),
          })),
        }),
    });
    reportUnlocksSelectMock.mockResolvedValue({ data: [] });
    fitmentInterviewsSelectMock.mockReturnValue({ eq: fitmentInterviewsEq });
    fitmentInterviewsEq.mockResolvedValue({ data: [] });
    personalityTestsSelectMock.mockResolvedValue({ data: [] });
    referenceChecksSelectMock.mockReturnValue({ eq: referenceChecksEq });
    referenceChecksEq.mockResolvedValue({ data: [] });
  }

  beforeEach(() => {
    fitmentLeadsSelectMock.mockReset();
    reportUnlocksSelectMock.mockReset();
    fitmentInterviewsSelectMock.mockReset();
    fitmentInterviewsEq.mockReset();
    personalityTestsSelectMock.mockReset();
    referenceChecksSelectMock.mockReset();
    referenceChecksEq.mockReset();
  });

  it("returns page 1 of 20 rows with correct total/totalPages when there are 25 candidates", async () => {
    stubCandidates(25);
    const { listCandidates } = await import("../adminCandidates");

    const result = await listCandidates(1);

    expect(result.rows).toHaveLength(20);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(1);
  });

  it("returns the remaining 5 rows on page 2", async () => {
    stubCandidates(25);
    const { listCandidates } = await import("../adminCandidates");

    const result = await listCandidates(2);

    expect(result.rows).toHaveLength(5);
    expect(result.page).toBe(2);
  });

  it("clamps an out-of-range page to the last page", async () => {
    stubCandidates(25);
    const { listCandidates } = await import("../adminCandidates");

    const result = await listCandidates(999);

    expect(result.page).toBe(2);
    expect(result.rows).toHaveLength(5);
  });

  it("clamps page below 1 up to 1", async () => {
    stubCandidates(25);
    const { listCandidates } = await import("../adminCandidates");

    const result = await listCandidates(0);

    expect(result.page).toBe(1);
  });

  it("defaults page and totalPages to 1 when there are no candidates", async () => {
    stubCandidates(0);
    const { listCandidates } = await import("../adminCandidates");

    const result = await listCandidates();

    expect(result).toEqual({ rows: [], total: 0, totalPages: 1, page: 1 });
  });
});

describe("updateRecruiterPreviewOverride", () => {
  beforeEach(() => {
    recruiterPreviewSelectMock.mockReset();
    recruiterPreviewUpsertMock.mockReset();
    recruiterPreviewUpsertMock.mockResolvedValue({ error: null });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("upserts settings and logs the prior/new values with the reason", async () => {
    recruiterPreviewSelectMock.mockReturnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: { enabled: false, sections: [], linkedin_url: "https://linkedin.com/in/x" } }) }),
    });
    const { updateRecruiterPreviewOverride } = await import("../adminCandidates");

    await updateRecruiterPreviewOverride("user-1", { enabled: true, sections: ["fitment"] }, "roshan@merito.in", "candidate requested");

    expect(recruiterPreviewUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", enabled: true, sections: ["fitment"] }),
      { onConflict: "user_id" }
    );
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "candidate.recruiter_preview_override",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: { enabled: false, sections: [] },
      newValue: { enabled: true, sections: ["fitment"], reason: "candidate requested" },
    });
  });

  it("throws when enabling without a LinkedIn URL on file", async () => {
    recruiterPreviewSelectMock.mockReturnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: { enabled: false, sections: [], linkedin_url: null } }) }),
    });
    const { updateRecruiterPreviewOverride } = await import("../adminCandidates");

    await expect(
      updateRecruiterPreviewOverride("user-1", { enabled: true, sections: [] }, "roshan@merito.in", "x")
    ).rejects.toThrow(/LinkedIn/);
    expect(recruiterPreviewUpsertMock).not.toHaveBeenCalled();
  });

  it("throws on an invalid section", async () => {
    recruiterPreviewSelectMock.mockReturnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: { enabled: false, sections: [], linkedin_url: null } }) }),
    });
    const { updateRecruiterPreviewOverride } = await import("../adminCandidates");

    await expect(
      updateRecruiterPreviewOverride("user-1", { enabled: false, sections: ["bogus" as never] }, "roshan@merito.in", "x")
    ).rejects.toThrow(/sections must only contain/);
  });

  it("treats a missing settings row as enabled:false, sections:[]", async () => {
    recruiterPreviewSelectMock.mockReturnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
    });
    const { updateRecruiterPreviewOverride } = await import("../adminCandidates");

    await updateRecruiterPreviewOverride("user-1", { enabled: false, sections: [] }, "roshan@merito.in", "x");

    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ priorValue: { enabled: false, sections: [] } })
    );
  });
});

describe("overrideInterviewReport", () => {
  const rowSelectMaybeSingle = vi.fn();
  const rowUpdateEq = vi.fn();

  beforeEach(() => {
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
    rowSelectMaybeSingle.mockReset();
    rowUpdateEq.mockReset();
    rowUpdateEq.mockResolvedValue({ error: null });
    fitmentInterviewsSelectMock.mockReset();
    fitmentInterviewsSelectMock.mockReturnValue({ eq: () => ({ maybeSingle: rowSelectMaybeSingle }) });
    fitmentInterviewsUpdateMock.mockReset();
    fitmentInterviewsUpdateMock.mockReturnValue({ eq: rowUpdateEq });
  });

  it("merges the override into report_raw and logs prior/new values", async () => {
    rowSelectMaybeSingle.mockResolvedValue({
      data: { status: "ready", report_raw: { overallScore: 6, overallSummary: "Old summary", skillMetrics: { comms: 7 } } },
      error: null,
    });

    const { overrideInterviewReport } = await import("../adminCandidates");
    await overrideInterviewReport("row-1", { overallScore: 9, overallSummary: "Better summary" }, "roshan@merito.in", "misjudged tone");

    expect(rowUpdateEq).toHaveBeenCalledWith("id", "row-1");
    expect(fitmentInterviewsUpdateMock).toHaveBeenCalledWith({
      report_raw: expect.objectContaining({ overallScore: 9, overallSummary: "Better summary", skillMetrics: { comms: 7 } }),
      report_overridden: true,
    });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "interview.report_override",
      targetType: "interview",
      targetId: "row-1",
      priorValue: { overallScore: 6, overallSummary: "Old summary" },
      newValue: { overallScore: 9, overallSummary: "Better summary", reason: "misjudged tone" },
    });
  });

  it("throws when the interview isn't ready yet", async () => {
    rowSelectMaybeSingle.mockResolvedValue({ data: { status: "invited" }, error: null });

    const { overrideInterviewReport } = await import("../adminCandidates");
    await expect(
      overrideInterviewReport("row-1", { overallScore: 9, overallSummary: "x" }, "roshan@merito.in", "x")
    ).rejects.toThrow(/isn't ready/);
    expect(fitmentInterviewsUpdateMock).not.toHaveBeenCalled();
  });

  it("throws on an out-of-range score", async () => {
    const { overrideInterviewReport } = await import("../adminCandidates");
    await expect(
      overrideInterviewReport("row-1", { overallScore: 15, overallSummary: "x" }, "roshan@merito.in", "x")
    ).rejects.toThrow(/between 0 and 10/);
    expect(rowSelectMaybeSingle).not.toHaveBeenCalled();
  });
});

describe("clearInterviewOverride", () => {
  const rowSelectMaybeSingle = vi.fn();
  const rowUpdateEq = vi.fn();

  beforeEach(() => {
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
    rowSelectMaybeSingle.mockReset();
    rowUpdateEq.mockReset();
    rowUpdateEq.mockResolvedValue({ error: null });
    fitmentInterviewsSelectMock.mockReset();
    fitmentInterviewsSelectMock.mockReturnValue({ eq: () => ({ maybeSingle: rowSelectMaybeSingle }) });
    fitmentInterviewsUpdateMock.mockReset();
    fitmentInterviewsUpdateMock.mockReturnValue({ eq: rowUpdateEq });
  });

  it("resets the flag and logs the reason", async () => {
    rowSelectMaybeSingle.mockResolvedValue({ data: { id: "row-1" }, error: null });

    const { clearInterviewOverride } = await import("../adminCandidates");
    await clearInterviewOverride("row-1", "roshan@merito.in", "resync needed");

    expect(fitmentInterviewsUpdateMock).toHaveBeenCalledWith({ report_overridden: false });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "interview.report_override_cleared",
      targetType: "interview",
      targetId: "row-1",
      priorValue: { overridden: true },
      newValue: { overridden: false, reason: "resync needed" },
    });
  });

  it("throws when the interview doesn't exist", async () => {
    rowSelectMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { clearInterviewOverride } = await import("../adminCandidates");
    await expect(clearInterviewOverride("row-1", "roshan@merito.in", "x")).rejects.toThrow("Interview not found.");
    expect(fitmentInterviewsUpdateMock).not.toHaveBeenCalled();
  });
});

describe("resyncInterviewReport", () => {
  const rowSelectMaybeSingle = vi.fn();
  const rowUpdateEq = vi.fn();

  beforeEach(() => {
    getInterviewReportMock.mockReset();
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
    rowSelectMaybeSingle.mockReset();
    rowUpdateEq.mockReset();
    rowUpdateEq.mockResolvedValue({ error: null });
    fitmentInterviewsSelectMock.mockReset();
    fitmentInterviewsSelectMock.mockReturnValue({ eq: () => ({ maybeSingle: rowSelectMaybeSingle }) });
    fitmentInterviewsUpdateMock.mockReset();
    fitmentInterviewsUpdateMock.mockReturnValue({ eq: rowUpdateEq });
  });

  it("overwrites report_raw when the vendor still reports READY", async () => {
    rowSelectMaybeSingle.mockResolvedValue({
      data: { status: "ready", report_overridden: false, ib_agent_id: "agent-1", ib_candidate_id: "cand-1" },
      error: null,
    });
    getInterviewReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 7,
      skillMetrics: {},
      overallSummary: "Updated",
      strengths: [],
      areasOfImprovement: [],
      shareableReportLink: null,
      approxDurationMinutes: 10,
      flagForSuspiciousActivity: false,
      integrityCheck: null,
      videoReport: null,
      feedbackToInterviewer: null,
      roadmap: null,
      criteriaEvaluationTable: [],
      interviewTitle: "Title",
      skillReport: {},
      overallSkillScore: 7,
      answers: [],
      knowledgeAnswers: [],
    });

    const { resyncInterviewReport } = await import("../adminCandidates");
    await resyncInterviewReport("row-1", "roshan@merito.in");

    expect(getInterviewReportMock).toHaveBeenCalledWith("agent-1", "cand-1");
    expect(rowUpdateEq).toHaveBeenCalledWith("id", "row-1");
    expect(fitmentInterviewsUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ report_raw: expect.objectContaining({ overallScore: 7, overallSummary: "Updated" }) })
    );
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "interview.report_resynced", targetId: "row-1" })
    );
  });

  it("refuses to resync when the report was manually overridden", async () => {
    rowSelectMaybeSingle.mockResolvedValue({
      data: { status: "ready", report_overridden: true, ib_agent_id: "agent-1", ib_candidate_id: "cand-1" },
      error: null,
    });

    const { resyncInterviewReport } = await import("../adminCandidates");
    await expect(resyncInterviewReport("row-1", "roshan@merito.in")).rejects.toThrow(/manually overridden/);
    expect(getInterviewReportMock).not.toHaveBeenCalled();
  });

  it("throws when the interview isn't ready yet", async () => {
    rowSelectMaybeSingle.mockResolvedValue({ data: { status: "invited", report_overridden: false }, error: null });

    const { resyncInterviewReport } = await import("../adminCandidates");
    await expect(resyncInterviewReport("row-1", "roshan@merito.in")).rejects.toThrow(/isn't ready/);
  });
});

describe("overrideCandidateProfile", () => {
  beforeEach(() => {
    profileOverrideSelectMock.mockReset();
    profileOverrideUpsertMock.mockReset();
    profileOverrideUpsertMock.mockResolvedValue({ error: null });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("upserts the override and logs prior/new values with the reason", async () => {
    profileOverrideSelectMock.mockReturnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: { phone_number: "111", location: "Old City", total_experience: 2 } }) }),
    });
    const { overrideCandidateProfile } = await import("../adminCandidates");

    await overrideCandidateProfile(
      "user-1",
      { phoneNumber: "222", location: "New City", totalExperience: 3.5 },
      "roshan@merito.in",
      "resume parser got the city wrong"
    );

    expect(profileOverrideUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", phone_number: "222", location: "New City", total_experience: 3.5 }),
      { onConflict: "user_id" }
    );
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "candidate.profile_override",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: { phoneNumber: "111", location: "Old City", totalExperience: 2 },
      newValue: { phoneNumber: "222", location: "New City", totalExperience: 3.5, reason: "resume parser got the city wrong" },
    });
  });

  it("treats a missing override row as null prior value", async () => {
    profileOverrideSelectMock.mockReturnValue({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) });
    const { overrideCandidateProfile } = await import("../adminCandidates");

    await overrideCandidateProfile("user-1", { phoneNumber: null, location: null, totalExperience: null }, "roshan@merito.in", "x");

    expect(logAdminActionMock).toHaveBeenCalledWith(expect.objectContaining({ priorValue: null }));
  });

  it("throws on a negative totalExperience", async () => {
    const { overrideCandidateProfile } = await import("../adminCandidates");
    await expect(
      overrideCandidateProfile("user-1", { phoneNumber: null, location: null, totalExperience: -1 }, "roshan@merito.in", "x")
    ).rejects.toThrow(/non-negative/);
    expect(profileOverrideUpsertMock).not.toHaveBeenCalled();
  });
});

describe("resolveBroadcastAudience", () => {
  const fitmentInterviewsEq = vi.fn();
  const referenceChecksEq = vi.fn();
  const candidateDeletionsIs = vi.fn();

  function stubCandidates(rows: Array<{ userId: string; roleTitle: string }>) {
    fitmentLeadsSelectMock.mockReturnValue({
      order: () =>
        Promise.resolve({
          data: rows.map((r, i) => ({
            user_id: r.userId,
            email: `${r.userId}@example.com`,
            name: `Name ${i}`,
            role_title: r.roleTitle,
            created_at: new Date(2026, 0, i + 1).toISOString(),
          })),
        }),
    });
    reportUnlocksSelectMock.mockResolvedValue({ data: [] });
    fitmentInterviewsSelectMock.mockReturnValue({ eq: fitmentInterviewsEq });
    fitmentInterviewsEq.mockResolvedValue({ data: [] });
    personalityTestsSelectMock.mockResolvedValue({ data: [] });
    referenceChecksSelectMock.mockReturnValue({ eq: referenceChecksEq });
    referenceChecksEq.mockResolvedValue({ data: [] });
  }

  beforeEach(() => {
    fitmentLeadsSelectMock.mockReset();
    reportUnlocksSelectMock.mockReset();
    fitmentInterviewsSelectMock.mockReset();
    fitmentInterviewsEq.mockReset();
    personalityTestsSelectMock.mockReset();
    referenceChecksSelectMock.mockReset();
    referenceChecksEq.mockReset();
    candidateDeletionsSelectMock.mockReset();
    candidateDeletionsIs.mockReset();
    candidateDeletionsSelectMock.mockReturnValue({ is: candidateDeletionsIs });
    candidateDeletionsIs.mockResolvedValue({ data: [] });
    listUsersMock.mockReset();
    listUsersMock.mockResolvedValue({ data: { users: [] }, error: null });
  });

  it("returns all candidates when no filters are given", async () => {
    stubCandidates([
      { userId: "user-0", roleTitle: "Product Manager" },
      { userId: "user-1", roleTitle: "Software Engineer" },
    ]);
    const { resolveBroadcastAudience } = await import("../adminCandidates");

    const result = await resolveBroadcastAudience({});

    expect(result.map((c) => c.userId)).toEqual(["user-1", "user-0"]);
  });

  it("filters by funnel stage", async () => {
    stubCandidates([
      { userId: "user-0", roleTitle: "Product Manager" },
      { userId: "user-1", roleTitle: "Product Manager" },
    ]);
    reportUnlocksSelectMock.mockResolvedValue({ data: [{ user_id: "user-0" }] });
    const { resolveBroadcastAudience } = await import("../adminCandidates");

    const result = await resolveBroadcastAudience({ funnelStages: ["report_unlocked"] });

    expect(result.map((c) => c.userId)).toEqual(["user-0"]);
  });

  it("filters by role title", async () => {
    stubCandidates([
      { userId: "user-0", roleTitle: "Product Manager" },
      { userId: "user-1", roleTitle: "Software Engineer" },
    ]);
    const { resolveBroadcastAudience } = await import("../adminCandidates");

    const result = await resolveBroadcastAudience({ roleTitles: ["Software Engineer"] });

    expect(result.map((c) => c.userId)).toEqual(["user-1"]);
  });

  it("excludes candidates with a pending deletion", async () => {
    stubCandidates([
      { userId: "user-0", roleTitle: "Product Manager" },
      { userId: "user-1", roleTitle: "Product Manager" },
    ]);
    candidateDeletionsIs.mockResolvedValue({ data: [{ user_id: "user-1" }] });
    const { resolveBroadcastAudience } = await import("../adminCandidates");

    const result = await resolveBroadcastAudience({});

    expect(result.map((c) => c.userId)).toEqual(["user-0"]);
  });

  it("excludes currently banned candidates", async () => {
    stubCandidates([
      { userId: "user-0", roleTitle: "Product Manager" },
      { userId: "user-1", roleTitle: "Product Manager" },
    ]);
    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: "user-1", banned_until: farFuture }] },
      error: null,
    });
    const { resolveBroadcastAudience } = await import("../adminCandidates");

    const result = await resolveBroadcastAudience({});

    expect(result.map((c) => c.userId)).toEqual(["user-0"]);
  });

  it("does not exclude a user whose ban_until is in the past", async () => {
    stubCandidates([{ userId: "user-0", roleTitle: "Product Manager" }]);
    const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: "user-0", banned_until: pastDate }] },
      error: null,
    });
    const { resolveBroadcastAudience } = await import("../adminCandidates");

    const result = await resolveBroadcastAudience({});

    expect(result.map((c) => c.userId)).toEqual(["user-0"]);
  });

  it("throws when the candidate_deletions query fails", async () => {
    stubCandidates([
      { userId: "user-0", roleTitle: "Product Manager" },
      { userId: "user-1", roleTitle: "Product Manager" },
    ]);
    candidateDeletionsIs.mockResolvedValue({ data: null, error: { message: "query timeout" } });
    const { resolveBroadcastAudience } = await import("../adminCandidates");

    await expect(resolveBroadcastAudience({})).rejects.toThrow("Failed to load pending deletions: query timeout");
  });

  it("throws rather than silently returning an empty/wrong audience when fitment_leads fails", async () => {
    fitmentLeadsSelectMock.mockReturnValue({
      order: () => Promise.resolve({ data: null, error: { message: "query timeout" } }),
    });
    reportUnlocksSelectMock.mockResolvedValue({ data: [] });
    fitmentInterviewsSelectMock.mockReturnValue({ eq: fitmentInterviewsEq });
    fitmentInterviewsEq.mockResolvedValue({ data: [] });
    personalityTestsSelectMock.mockResolvedValue({ data: [] });
    referenceChecksSelectMock.mockReturnValue({ eq: referenceChecksEq });
    referenceChecksEq.mockResolvedValue({ data: [] });
    const { resolveBroadcastAudience } = await import("../adminCandidates");

    await expect(resolveBroadcastAudience({})).rejects.toThrow("Failed to load fitment leads: query timeout");
  });
});

describe("findDuplicateCandidates", () => {
  const fitmentInterviewsEq = vi.fn();
  const referenceChecksEq = vi.fn();
  const candidateDeletionsIs = vi.fn();

  function stubCandidates(rows: Array<{ userId: string; email: string; name: string | null; roleTitle?: string }>) {
    fitmentLeadsSelectMock.mockReturnValue({
      order: () =>
        Promise.resolve({
          data: rows.map((r, i) => ({
            user_id: r.userId,
            email: r.email,
            name: r.name,
            role_title: r.roleTitle ?? "Software Engineer",
            created_at: new Date(2026, 0, i + 1).toISOString(),
          })),
        }),
    });
    reportUnlocksSelectMock.mockResolvedValue({ data: [] });
    fitmentInterviewsSelectMock.mockReturnValue({ eq: fitmentInterviewsEq });
    fitmentInterviewsEq.mockResolvedValue({ data: [] });
    personalityTestsSelectMock.mockResolvedValue({ data: [] });
    referenceChecksSelectMock.mockReturnValue({ eq: referenceChecksEq });
    referenceChecksEq.mockResolvedValue({ data: [] });
  }

  beforeEach(() => {
    fitmentLeadsSelectMock.mockReset();
    reportUnlocksSelectMock.mockReset();
    fitmentInterviewsSelectMock.mockReset();
    fitmentInterviewsEq.mockReset();
    personalityTestsSelectMock.mockReset();
    referenceChecksSelectMock.mockReset();
    referenceChecksEq.mockReset();
    candidateDeletionsSelectMock.mockReset();
    candidateDeletionsIs.mockReset();
    candidateDeletionsSelectMock.mockReturnValue({ is: candidateDeletionsIs });
    candidateDeletionsIs.mockResolvedValue({ data: [] });
    listUsersMock.mockReset();
    listUsersMock.mockResolvedValue({ data: { users: [] }, error: null });
  });

  it("groups gmail addresses that only differ by dots or a +alias", async () => {
    stubCandidates([
      { userId: "user-0", email: "j.doe+work@gmail.com", name: "Alpha" },
      { userId: "user-1", email: "jdoe@gmail.com", name: "Beta" },
      { userId: "user-2", email: "unrelated@gmail.com", name: "Gamma" },
    ]);
    const { findDuplicateCandidates } = await import("../adminCandidates");

    const { byEmail } = await findDuplicateCandidates();

    expect(byEmail).toHaveLength(1);
    expect(byEmail[0].candidates.map((c) => c.userId).sort()).toEqual(["user-0", "user-1"]);
  });

  it("does not conflate dot-stripping across non-gmail domains", async () => {
    stubCandidates([
      { userId: "user-0", email: "j.doe@example.com", name: "Alpha" },
      { userId: "user-1", email: "jdoe@example.com", name: "Beta" },
    ]);
    const { findDuplicateCandidates } = await import("../adminCandidates");

    const { byEmail } = await findDuplicateCandidates();

    expect(byEmail).toHaveLength(0);
  });

  it("groups candidates with the same name, case-insensitively", async () => {
    stubCandidates([
      { userId: "user-0", email: "a@example.com", name: "Priya Shah" },
      { userId: "user-1", email: "b@example.com", name: "priya shah" },
    ]);
    const { findDuplicateCandidates } = await import("../adminCandidates");

    const { byName } = await findDuplicateCandidates();

    expect(byName).toHaveLength(1);
    expect(byName[0].candidates.map((c) => c.userId).sort()).toEqual(["user-0", "user-1"]);
  });

  it("excludes banned and pending-deletion accounts from both signals", async () => {
    stubCandidates([
      { userId: "user-0", email: "jdoe@gmail.com", name: "Priya Shah" },
      { userId: "user-1", email: "j.doe@gmail.com", name: "priya shah" },
    ]);
    candidateDeletionsIs.mockResolvedValue({ data: [{ user_id: "user-1" }] });
    const { findDuplicateCandidates } = await import("../adminCandidates");

    const { byEmail, byName } = await findDuplicateCandidates();

    expect(byEmail).toHaveLength(0);
    expect(byName).toHaveLength(0);
  });
});

describe("broadcastCandidateNotification", () => {
  const candidateDeletionsIs = vi.fn();
  const fitmentInterviewsEq = vi.fn();
  const referenceChecksEq = vi.fn();

  function stubCandidates(count: number) {
    fitmentLeadsSelectMock.mockReturnValue({
      order: () =>
        Promise.resolve({
          data: Array.from({ length: count }, (_, i) => ({
            user_id: `user-${i}`,
            email: `user${i}@example.com`,
            name: `User ${i}`,
            role_title: "Product Manager",
            created_at: new Date(2026, 0, i + 1).toISOString(),
          })),
        }),
    });
    reportUnlocksSelectMock.mockResolvedValue({ data: [] });
    fitmentInterviewsSelectMock.mockReturnValue({ eq: fitmentInterviewsEq });
    fitmentInterviewsEq.mockResolvedValue({ data: [] });
    personalityTestsSelectMock.mockResolvedValue({ data: [] });
    referenceChecksSelectMock.mockReturnValue({ eq: referenceChecksEq });
    referenceChecksEq.mockResolvedValue({ data: [] });
  }

  beforeEach(() => {
    fitmentLeadsSelectMock.mockReset();
    reportUnlocksSelectMock.mockReset();
    fitmentInterviewsSelectMock.mockReset();
    fitmentInterviewsEq.mockReset();
    personalityTestsSelectMock.mockReset();
    referenceChecksSelectMock.mockReset();
    referenceChecksEq.mockReset();
    candidateDeletionsSelectMock.mockReset();
    candidateDeletionsIs.mockReset();
    candidateDeletionsSelectMock.mockReturnValue({ is: candidateDeletionsIs });
    candidateDeletionsIs.mockResolvedValue({ data: [] });
    listUsersMock.mockReset();
    listUsersMock.mockResolvedValue({ data: { users: [] }, error: null });
    hubNotificationsInsertMock.mockReset();
    hubNotificationsInsertMock.mockResolvedValue({ error: null });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("sends to every matching candidate in one chunk and logs one aggregate audit row", async () => {
    stubCandidates(3);
    const { broadcastCandidateNotification } = await import("../adminCandidates");

    const result = await broadcastCandidateNotification({}, "Hello all", "general", "roshan@merito.in");

    expect(result).toEqual({ sent: 3, failed: 0 });
    expect(hubNotificationsInsertMock).toHaveBeenCalledTimes(1);
    expect(hubNotificationsInsertMock).toHaveBeenCalledWith([
      { user_id: "user-2", message: "Hello all", category: "general", created_by: "roshan@merito.in" },
      { user_id: "user-1", message: "Hello all", category: "general", created_by: "roshan@merito.in" },
      { user_id: "user-0", message: "Hello all", category: "general", created_by: "roshan@merito.in" },
    ]);
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "notification.broadcast",
      targetType: "broadcast",
      targetId: expect.any(String),
      priorValue: null,
      newValue: { filters: {}, message: "Hello all", category: "general", sent: 3, failed: 0 },
    });
  });

  it("splits sends into 500-row chunks", async () => {
    stubCandidates(501);
    const { broadcastCandidateNotification } = await import("../adminCandidates");

    const result = await broadcastCandidateNotification({}, "Big send", "general", "roshan@merito.in");

    expect(result).toEqual({ sent: 501, failed: 0 });
    expect(hubNotificationsInsertMock).toHaveBeenCalledTimes(2);
    expect(hubNotificationsInsertMock.mock.calls[0][0]).toHaveLength(500);
    expect(hubNotificationsInsertMock.mock.calls[1][0]).toHaveLength(1);
  });

  it("continues past a failed chunk and reports partial failure", async () => {
    stubCandidates(501);
    hubNotificationsInsertMock.mockResolvedValueOnce({ error: { message: "db error" } }).mockResolvedValueOnce({ error: null });
    const { broadcastCandidateNotification } = await import("../adminCandidates");

    const result = await broadcastCandidateNotification({}, "Big send", "general", "roshan@merito.in");

    expect(result).toEqual({ sent: 1, failed: 500 });
    expect(hubNotificationsInsertMock).toHaveBeenCalledTimes(2);
    expect(logAdminActionMock).toHaveBeenCalledWith(expect.objectContaining({ newValue: expect.objectContaining({ sent: 1, failed: 500 }) }));
  });

  it("resolves with the real send counts even when the audit log write fails", async () => {
    stubCandidates(3);
    logAdminActionMock.mockRejectedValue(new Error("admin_audit_log insert failed"));
    const { broadcastCandidateNotification } = await import("../adminCandidates");

    // Must NOT reject -- every hub_notifications chunk already landed, so an
    // audit-log failure here must never be reported to the caller as a send
    // failure (that would invite a duplicate broadcast on retry).
    const result = await broadcastCandidateNotification({}, "Hello all", "general", "roshan@merito.in");

    expect(result).toEqual({ sent: 3, failed: 0 });
  });
});

describe("getCandidateDetail", () => {
  function lead(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "lead-1",
      role_title: "Product Manager",
      score: 7,
      name: "Test Candidate",
      email: "candidate@example.com",
      resume_match_status: "PENDING",
      resume_match_raw: null,
      resume_match_overridden: false,
      resume_text: null,
      ib_applied_job_id: null, // keeps candidateDetails resolution out of scope of these tests
      created_at: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  function interview(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "interview-1",
      lead_id: null,
      role_title: "Product Manager",
      status: "invited",
      report_raw: null,
      report_overridden: false,
      ib_agent_id: "agent-1",
      ib_candidate_id: "cand-1",
      updated_at: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  function stubLeadsAndInterviews(leadRows: Array<Record<string, unknown>>, interviewRows: Array<Record<string, unknown>>) {
    fitmentLeadsSelectMock.mockReturnValue({ eq: () => ({ order: () => Promise.resolve({ data: leadRows }) }) });
    fitmentInterviewsSelectMock.mockReturnValue({ eq: () => ({ order: () => Promise.resolve({ data: interviewRows }) }) });
  }

  beforeEach(() => {
    fitmentLeadsSelectMock.mockReset();
    fitmentInterviewsSelectMock.mockReset();
    personalityTestsSelectMock.mockReset();
    personalityTestsSelectMock.mockReturnValue({
      eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
    });
    getReferenceCheckStatusMock.mockReset();
    getReferenceCheckStatusMock.mockResolvedValue(null);
    recruiterPreviewSelectMock.mockReset();
    recruiterPreviewSelectMock.mockReturnValue({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) });
    reportShareLinksSelectMock.mockReset();
    reportShareLinksSelectMock.mockReturnValue({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) });
    candidateDeletionsSelectMock.mockReset();
    candidateDeletionsSelectMock.mockReturnValue({ eq: () => ({ is: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) });
    profileOverrideSelectMock.mockReset();
    profileOverrideSelectMock.mockReturnValue({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) });
    listActionsForTargetMock.mockReset();
    listActionsForTargetMock.mockResolvedValue([]);
  });

  it("matches an interview to its lead by lead_id when present", async () => {
    stubLeadsAndInterviews(
      [lead({ id: "lead-1", role_title: "Product Manager" })],
      [interview({ id: "interview-1", lead_id: "lead-1", role_title: "Product Manager", status: "ready", report_raw: { overallScore: 8 } })]
    );
    const { getCandidateDetail } = await import("../adminCandidates");

    const detail = await getCandidateDetail("user-1");

    expect(detail!.leads[0].interviewReport).toEqual({ overallScore: 8 });
    expect(detail!.leads[0].interviewRow).toEqual({ id: "interview-1", status: "ready", ibAgentId: "agent-1", ibCandidateId: "cand-1" });
  });

  it("falls back to matching by role_title when the interview's lead_id is null (historical, pre-backfill rows)", async () => {
    stubLeadsAndInterviews(
      [lead({ id: "lead-2", role_title: "Product Manager" })],
      [interview({ id: "interview-2", lead_id: null, role_title: "Product Manager", status: "ready", report_raw: { overallScore: 5 } })]
    );
    const { getCandidateDetail } = await import("../adminCandidates");

    const detail = await getCandidateDetail("user-1");

    expect(detail!.leads[0].interviewReport).toEqual({ overallScore: 5 });
    expect(detail!.leads[0].interviewRow?.id).toBe("interview-2");
  });

  it("does not fall through to a role_title sibling's report when the id-matched interview has no report of its own", async () => {
    stubLeadsAndInterviews(
      [lead({ id: "lead-1", role_title: "Product Manager" })],
      [
        // Exact id link to lead-1, but not ready yet -- `.has()` on this key
        // must report true while its report value is null.
        interview({ id: "iv-1", lead_id: "lead-1", role_title: "Product Manager", status: "invited", report_raw: null, updated_at: "2026-01-02T00:00:00Z" }),
        // Unlinked (lead_id null) interview that merely shares role_title,
        // with a real ready report -- must never be attributed to lead-1.
        // A `??`-based join would wrongly fall through to this sibling's
        // report; `.has()` must keep lead-1's report null instead.
        interview({
          id: "iv-2",
          lead_id: null,
          role_title: "Product Manager",
          status: "ready",
          report_raw: { overallScore: 9 },
          updated_at: "2026-01-01T00:00:00Z",
        }),
      ]
    );
    const { getCandidateDetail } = await import("../adminCandidates");

    const detail = await getCandidateDetail("user-1");

    expect(detail!.leads[0].interviewReport).toBeNull();
    expect(detail!.leads[0].interviewRow?.id).toBe("iv-1");
  });
});
