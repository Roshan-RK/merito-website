import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
const logAdminActionMock = vi.fn();
const listActionsForTargetMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/adminAuditLog", () => ({
  logAdminAction: logAdminActionMock,
  listActionsForTarget: listActionsForTargetMock,
}));

describe("referenceChecks", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  describe("initiateReferenceCheck", () => {
    it("throws ALREADY_ACTIVE when an initiated/in_progress check exists", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "check-1" }, error: null });
      const inFn = vi.fn().mockReturnValue({ maybeSingle });
      const eqFn = vi.fn().mockReturnValue({ in: inFn });
      const select = vi.fn().mockReturnValue({ eq: eqFn });
      fromMock.mockReturnValue({ select });

      const { initiateReferenceCheck } = await import("../referenceChecks");
      await expect(initiateReferenceCheck("user-1")).rejects.toThrow("ALREADY_ACTIVE");
    });

    it("inserts a new reference_checks row when none is active", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const inFn = vi.fn().mockReturnValue({ maybeSingle });
      const eqFn = vi.fn().mockReturnValue({ in: inFn });
      const select = vi.fn().mockReturnValue({ eq: eqFn });

      const insertSelect = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "check-new" }, error: null }) });
      const insert = vi.fn().mockReturnValue({ select: insertSelect });

      fromMock.mockReturnValueOnce({ select }).mockReturnValueOnce({ insert });

      const { initiateReferenceCheck } = await import("../referenceChecks");
      const result = await initiateReferenceCheck("user-1");
      expect(result).toEqual({ id: "check-new" });
      expect(insert).toHaveBeenCalledWith({ user_id: "user-1", min_references: 3 });
    });
  });

  describe("addReferee", () => {
    it("throws MAX_REFEREES_REACHED at the 10-slot cap", async () => {
      const select = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 10, error: null }) });
      fromMock.mockReturnValue({ select });

      const { addReferee } = await import("../referenceChecks");
      await expect(
        addReferee("check-1", { name: "Jane", email: "jane@example.com", role: "manager" })
      ).rejects.toThrow("MAX_REFEREES_REACHED");
    });

    it("throws DUPLICATE_REFEREE when the (reference_check_id, email) unique constraint is hit", async () => {
      const countSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 0, error: null }) });
      const insertSelect = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "23505", message: 'duplicate key value violates unique constraint "referees_reference_check_id_email_key"' },
        }),
      });
      const insert = vi.fn().mockReturnValue({ select: insertSelect });

      fromMock.mockReturnValueOnce({ select: countSelect }).mockReturnValueOnce({ insert });

      const { addReferee } = await import("../referenceChecks");
      await expect(
        addReferee("check-1", { name: "Jane", email: "jane@example.com", role: "manager" })
      ).rejects.toThrow("DUPLICATE_REFEREE");
    });

    it("inserts a referee row and flips the check to in_progress", async () => {
      const countSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 0, error: null }) });
      const insertSelect = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "referee-1" }, error: null }) });
      const insert = vi.fn().mockReturnValue({ select: insertSelect });
      const updateEq2 = vi.fn().mockResolvedValue({ error: null });
      const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
      const update = vi.fn().mockReturnValue({ eq: updateEq1 });

      fromMock
        .mockReturnValueOnce({ select: countSelect })
        .mockReturnValueOnce({ insert })
        .mockReturnValueOnce({ update });

      const { addReferee } = await import("../referenceChecks");
      const result = await addReferee("check-1", { name: "Jane", email: "jane@example.com", role: "manager" });

      expect(result).toEqual({ id: "referee-1" });
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ reference_check_id: "check-1", name: "Jane", email: "jane@example.com", role: "manager" })
      );
      expect(update).toHaveBeenCalledWith({ status: "in_progress" });
    });
  });

  describe("getReferenceCheckStatus", () => {
    it("returns null when the user has no reference check", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const order = vi.fn().mockReturnValue({ limit });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      fromMock.mockReturnValue({ select });

      const { getReferenceCheckStatus } = await import("../referenceChecks");
      const result = await getReferenceCheckStatus("user-1");
      expect(result).toBeNull();
    });

    it("returns the check plus its referees", async () => {
      const checkMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "check-1", status: "in_progress", min_references: 3 }, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle: checkMaybeSingle });
      const order1 = vi.fn().mockReturnValue({ limit });
      const eq1 = vi.fn().mockReturnValue({ order: order1 });
      const checkSelect = vi.fn().mockReturnValue({ eq: eq1 });

      const refereesOrder = vi.fn().mockResolvedValue({
        data: [{ id: "r1", name: "Jane", email: "jane@example.com", status: "pending", reminder_count: 0 }],
        error: null,
      });
      const eq2 = vi.fn().mockReturnValue({ order: refereesOrder });
      const refereesSelect = vi.fn().mockReturnValue({ eq: eq2 });

      fromMock.mockReturnValueOnce({ select: checkSelect }).mockReturnValueOnce({ select: refereesSelect });

      const { getReferenceCheckStatus } = await import("../referenceChecks");
      const result = await getReferenceCheckStatus("user-1");

      expect(result).toEqual({
        checkId: "check-1",
        status: "in_progress",
        minReferences: 3,
        referees: [{ id: "r1", name: "Jane", email: "jane@example.com", status: "pending", reminder_count: 0 }],
      });
    });
  });

  describe("recordRefereeFeedback", () => {
    it("marks the referee completed and auto-completes the check at the threshold", async () => {
      const refereeSingle = vi.fn().mockResolvedValue({ data: { reference_check_id: "check-1", status: "pending" }, error: null });
      const refereeEq = vi.fn().mockReturnValue({ single: refereeSingle });
      const refereeSelect = vi.fn().mockReturnValue({ eq: refereeEq });

      const updateEq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq: updateEq });

      const checkSingle = vi.fn().mockResolvedValue({ data: { min_references: 3, status: "in_progress" }, error: null });
      const checkEq = vi.fn().mockReturnValue({ single: checkSingle });
      const checkSelect = vi.fn().mockReturnValue({ eq: checkEq });

      const countEq2 = vi.fn().mockResolvedValue({ count: 3, error: null });
      const countEq1 = vi.fn().mockReturnValue({ eq: countEq2 });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq1 });

      const completeUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const completeUpdate = vi.fn().mockReturnValue({ eq: completeUpdateEq });

      fromMock
        .mockReturnValueOnce({ select: refereeSelect }) // fetch referee -> check id + status
        .mockReturnValueOnce({ update }) // update referee to completed
        .mockReturnValueOnce({ select: checkSelect }) // fetch check
        .mockReturnValueOnce({ select: countSelect }) // count completed referees
        .mockReturnValueOnce({ update: completeUpdate }); // mark check completed

      const { recordRefereeFeedback } = await import("../referenceChecks");
      await recordRefereeFeedback("referee-1", {
        ratings: [{ category: "teamwork", value: 5 }],
        overallFeedback: "Great teammate.",
      });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed", overall_feedback: "Great teammate." })
      );
      expect(completeUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    });

    it("throws REFEREE_ALREADY_RESPONDED when the referee is no longer pending", async () => {
      const refereeSingle = vi.fn().mockResolvedValue({ data: { reference_check_id: "check-1", status: "completed" }, error: null });
      const refereeEq = vi.fn().mockReturnValue({ single: refereeSingle });
      const refereeSelect = vi.fn().mockReturnValue({ eq: refereeEq });
      fromMock.mockReturnValueOnce({ select: refereeSelect });

      const { recordRefereeFeedback } = await import("../referenceChecks");
      await expect(
        recordRefereeFeedback("referee-1", { ratings: [{ category: "teamwork", value: 5 }], overallFeedback: "Great." })
      ).rejects.toThrow("REFEREE_ALREADY_RESPONDED");
      expect(fromMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("recordRefereeDecline", () => {
    it("marks the referee rejected", async () => {
      const refereeSingle = vi.fn().mockResolvedValue({ data: { status: "pending" }, error: null });
      const refereeEq = vi.fn().mockReturnValue({ single: refereeSingle });
      const refereeSelect = vi.fn().mockReturnValue({ eq: refereeEq });

      const updateEq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq: updateEq });

      fromMock.mockReturnValueOnce({ select: refereeSelect }).mockReturnValueOnce({ update });

      const { recordRefereeDecline } = await import("../referenceChecks");
      await recordRefereeDecline("referee-1");

      expect(update).toHaveBeenCalledWith({ status: "rejected" });
      expect(updateEq).toHaveBeenCalledWith("id", "referee-1");
    });

    it("throws REFEREE_ALREADY_RESPONDED when the referee is no longer pending", async () => {
      const refereeSingle = vi.fn().mockResolvedValue({ data: { status: "rejected" }, error: null });
      const refereeEq = vi.fn().mockReturnValue({ single: refereeSingle });
      const refereeSelect = vi.fn().mockReturnValue({ eq: refereeEq });
      fromMock.mockReturnValueOnce({ select: refereeSelect });

      const { recordRefereeDecline } = await import("../referenceChecks");
      await expect(recordRefereeDecline("referee-1")).rejects.toThrow("REFEREE_ALREADY_RESPONDED");
      expect(fromMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getStaleRefereesForReminder", () => {
    it("filters to referees whose parent check is still initiated/in_progress", async () => {
      const orMock = vi.fn().mockResolvedValue({
        data: [{ id: "r1", name: "Jane", email: "jane@example.com", reference_check_id: "check-1" }],
        error: null,
      });
      const inMock = vi.fn().mockReturnValue({ or: orMock });
      const ltMock = vi.fn().mockReturnValue({ in: inMock });
      const eqMock = vi.fn().mockReturnValue({ lt: ltMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      fromMock.mockReturnValue({ select: selectMock });

      const { getStaleRefereesForReminder } = await import("../referenceChecks");
      const result = await getStaleRefereesForReminder();

      expect(fromMock).toHaveBeenCalledWith("referees");
      expect(selectMock).toHaveBeenCalledWith(
        expect.stringContaining("reference_checks!inner(status)")
      );
      expect(inMock).toHaveBeenCalledWith("reference_checks.status", ["initiated", "in_progress"]);
      expect(result).toEqual([{ id: "r1", name: "Jane", email: "jane@example.com", reference_check_id: "check-1" }]);
    });
  });

  describe("getCandidateDisplayName", () => {
    it("returns the fitment_leads name when present", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: { name: "Alex Kumar" }, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const order = vi.fn().mockReturnValue({ limit });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      fromMock.mockReturnValue({ select });

      const { getCandidateDisplayName } = await import("../referenceChecks");
      const result = await getCandidateDisplayName("user-1");
      expect(result).toBe("Alex Kumar");
    });

    it("falls back to a generic label when no name is on file", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const order = vi.fn().mockReturnValue({ limit });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      fromMock.mockReturnValue({ select });

      const { getCandidateDisplayName } = await import("../referenceChecks");
      const result = await getCandidateDisplayName("user-1");
      expect(result).toBe("A Merito candidate");
    });
  });
});

describe("resetRefereeReminders", () => {
  it("sets reminder_count to 0 and clears last_reminded_at", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    fromMock.mockReturnValue({ update });

    const { resetRefereeReminders } = await import("../referenceChecks");
    await resetRefereeReminders("referee-1");

    expect(update).toHaveBeenCalledWith({ reminder_count: 0, last_reminded_at: null });
    expect(updateEq).toHaveBeenCalledWith("id", "referee-1");
  });

  it("throws when the update fails", async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: { message: "db error" } });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    fromMock.mockReturnValue({ update });

    const { resetRefereeReminders } = await import("../referenceChecks");
    await expect(resetRefereeReminders("referee-1")).rejects.toThrow("Failed to reset referee reminders: db error");
  });
});

describe("resetRefereeReminders re-admits a referee to the reminder sweep (integration)", () => {
  it("getStaleRefereesForReminder includes the referee after reset", async () => {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const or = vi.fn().mockResolvedValue({
      data: [{ id: "referee-1", name: "Jane", email: "jane@example.com", reference_check_id: "check-1" }],
      error: null,
    });
    const inFn = vi.fn().mockReturnValue({ or });
    const lt = vi.fn().mockReturnValue({ in: inFn });
    const eq = vi.fn().mockReturnValue({ lt });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ update, select });

    const { resetRefereeReminders, getStaleRefereesForReminder } = await import("../referenceChecks");
    await resetRefereeReminders("referee-1");
    const stale = await getStaleRefereesForReminder();

    expect(stale.map((r) => r.id)).toContain("referee-1");
  });
});

describe("updateRefereeContact", () => {
  beforeEach(() => {
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("updates contact fields and logs prior/new values with the reason", async () => {
    const existing = { name: "Jane Old", email: "old@example.com", phone: "111", organization: "Acme" };
    const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const selectEq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq: selectEq });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    fromMock.mockReturnValue({ select, update });

    const { updateRefereeContact } = await import("../referenceChecks");
    await updateRefereeContact(
      "referee-1",
      { name: "Jane New", email: "new@example.com", phone: "222", organization: "NewCo" },
      "roshan@merito.in",
      "typo fix"
    );

    expect(update).toHaveBeenCalledWith({ name: "Jane New", email: "new@example.com", phone: "222", organization: "NewCo" });
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "referee.update_contact",
      targetType: "referee",
      targetId: "referee-1",
      priorValue: existing,
      newValue: { name: "Jane New", email: "new@example.com", phone: "222", organization: "NewCo", reason: "typo fix" },
    });
  });

  it("throws when the referee doesn't exist", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
    fromMock.mockReturnValue({ select });

    const { updateRefereeContact } = await import("../referenceChecks");
    await expect(
      updateRefereeContact("referee-1", { name: "x", email: "x@x.com", phone: null, organization: null }, "roshan@merito.in", "x")
    ).rejects.toThrow("Referee not found.");
  });
});
