import { describe, it, expect, vi, beforeEach } from "vitest";

const updateUserByIdMock = vi.fn();
const deleteUserMock = vi.fn();
const generateLinkMock = vi.fn();
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
const recruiterPreviewSelectMock = vi.fn();
const recruiterPreviewUpsertMock = vi.fn();
const profileOverrideSelectMock = vi.fn();
const profileOverrideUpsertMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    auth: { admin: { updateUserById: updateUserByIdMock, deleteUser: deleteUserMock, generateLink: generateLinkMock } },
    from: (table: string) => {
      if (table === "fitment_leads") return { select: fitmentLeadsSelectMock, update: fitmentLeadsUpdateMock };
      if (table === "report_unlocks") return { select: reportUnlocksSelectMock };
      if (table === "fitment_interviews") return { select: fitmentInterviewsSelectMock, update: fitmentInterviewsUpdateMock };
      if (table === "personality_tests") return { select: personalityTestsSelectMock };
      if (table === "reference_checks") return { select: referenceChecksSelectMock };
      if (table === "hub_notifications") return { insert: hubNotificationsInsertMock };
      if (table === "candidate_deletions") return { insert: candidateDeletionsInsertMock, delete: candidateDeletionsDeleteMock };
      if (table === "recruiter_preview_settings") return { select: recruiterPreviewSelectMock, upsert: recruiterPreviewUpsertMock };
      if (table === "candidate_profile_overrides") return { select: profileOverrideSelectMock, upsert: profileOverrideUpsertMock };
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

const listActionsForTargetMock = vi.fn();
vi.mock("@/lib/adminAuditLog", () => ({
  logAdminAction: logAdminActionMock,
  listActionsForTarget: listActionsForTargetMock,
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
