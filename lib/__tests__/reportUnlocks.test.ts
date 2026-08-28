import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const isMock = vi.fn();
const limitMock = vi.fn();
const maybeSingleMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("reportUnlocks", () => {
  beforeEach(() => {
    fromMock.mockReset();
    insertMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    isMock.mockReset();
    limitMock.mockReset();
    maybeSingleMock.mockReset();

    // chainable builder: from().select().eq().eq().limit().maybeSingle() and .is()
    const builder = {
      select: selectMock,
      eq: eqMock,
      is: isMock,
      limit: limitMock,
      maybeSingle: maybeSingleMock,
      insert: insertMock,
    };
    fromMock.mockReturnValue(builder);
    selectMock.mockReturnValue(builder);
    eqMock.mockReturnValue(builder);
    isMock.mockReturnValue(builder);
    limitMock.mockReturnValue(builder);
    insertMock.mockResolvedValue({ error: null });
  });

  describe("isReportUnlocked", () => {
    it("1. returns true on a (user_id, lead_id) row and does NOT run the legacy query", async () => {
      maybeSingleMock.mockResolvedValueOnce({ data: { user_id: "user-123" }, error: null });

      const { isReportUnlocked } = await import("../reportUnlocks");
      const result = await isReportUnlocked("user-123", "lead-1", "Senior Product Manager");

      expect(result).toBe(true);
      expect(fromMock).toHaveBeenCalledWith("report_unlocks");
      expect(eqMock).toHaveBeenNthCalledWith(1, "user_id", "user-123");
      expect(eqMock).toHaveBeenNthCalledWith(2, "lead_id", "lead-1");
      expect(limitMock).toHaveBeenCalledWith(1);
      // legacy fallback never runs
      expect(maybeSingleMock).toHaveBeenCalledTimes(1);
      expect(isMock).not.toHaveBeenCalled();
    });

    it("2. falls back to a (user_id, role_title, lead_id IS NULL) row -> true", async () => {
      maybeSingleMock
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { user_id: "user-123" }, error: null });

      const { isReportUnlocked } = await import("../reportUnlocks");
      const result = await isReportUnlocked("user-123", "lead-1", "Senior Product Manager");

      expect(result).toBe(true);
      expect(maybeSingleMock).toHaveBeenCalledTimes(2);
      expect(eqMock).toHaveBeenCalledWith("role_title", "Senior Product Manager");
      expect(isMock).toHaveBeenCalledWith("lead_id", null);
      expect(limitMock).toHaveBeenCalledTimes(2);
    });

    it("3. returns false when neither the lead row nor a legacy row exists", async () => {
      maybeSingleMock
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      const { isReportUnlocked } = await import("../reportUnlocks");
      const result = await isReportUnlocked("user-123", "lead-1", "Senior Product Manager");

      expect(result).toBe(false);
      expect(maybeSingleMock).toHaveBeenCalledTimes(2);
    });

    it("throws when the lead-keyed query errors", async () => {
      maybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: "db error" } });

      const { isReportUnlocked } = await import("../reportUnlocks");
      await expect(isReportUnlocked("user-123", "lead-1", "Senior Product Manager")).rejects.toThrow(
        "Failed to check report unlock status: db error"
      );
    });

    it("throws when the legacy fallback query errors", async () => {
      maybeSingleMock
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: "db error" } });

      const { isReportUnlocked } = await import("../reportUnlocks");
      await expect(isReportUnlocked("user-123", "lead-1", "Senior Product Manager")).rejects.toThrow(
        "Failed to check report unlock status: db error"
      );
      expect(maybeSingleMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("unlockReport", () => {
    it("4. inserts { user_id, lead_id, role_title } with no onConflict argument", async () => {
      const { unlockReport } = await import("../reportUnlocks");

      await unlockReport("user-123", "lead-1", "Senior Product Manager");

      expect(fromMock).toHaveBeenCalledWith("report_unlocks");
      expect(insertMock).toHaveBeenCalledWith({
        user_id: "user-123",
        lead_id: "lead-1",
        role_title: "Senior Product Manager",
      });
      expect(insertMock.mock.calls[0]).toHaveLength(1);
    });

    it("5. swallows a 23505 unique_violation (already unlocked -> no throw)", async () => {
      insertMock.mockResolvedValue({ error: { code: "23505", message: "duplicate key value" } });
      const { unlockReport } = await import("../reportUnlocks");

      await expect(unlockReport("user-123", "lead-1", "Senior Product Manager")).resolves.toBeUndefined();
    });

    it("6. throws on any non-23505 error", async () => {
      insertMock.mockResolvedValue({ error: { code: "23503", message: "boom" } });
      const { unlockReport } = await import("../reportUnlocks");

      await expect(unlockReport("user-123", "lead-1", "Senior Product Manager")).rejects.toThrow(
        "Failed to unlock report: boom"
      );
    });
  });
});
