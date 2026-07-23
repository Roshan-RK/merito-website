import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn();
const eqMock1 = vi.fn();
const eqMock2 = vi.fn();
const maybeSingleMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: fromMock,
  }),
}));

describe("reportUnlocks", () => {
  beforeEach(() => {
    fromMock.mockReset();
    upsertMock.mockReset();
    selectMock.mockReset();
    eqMock1.mockReset();
    eqMock2.mockReset();
    maybeSingleMock.mockReset();
  });

  describe("unlockReport", () => {
    it("upserts a report_unlocks row keyed on user_id + lead_id", async () => {
      fromMock.mockReturnValue({ upsert: upsertMock });
      upsertMock.mockResolvedValue({ error: null });
      const { unlockReport } = await import("../reportUnlocks");

      await unlockReport("user-123", "lead-1");

      expect(fromMock).toHaveBeenCalledWith("report_unlocks");
      expect(upsertMock).toHaveBeenCalledWith(
        { user_id: "user-123", lead_id: "lead-1" },
        { onConflict: "user_id,lead_id" }
      );
    });

    it("does not throw when called twice for the same user+lead (idempotent)", async () => {
      fromMock.mockReturnValue({ upsert: upsertMock });
      upsertMock.mockResolvedValue({ error: null });
      const { unlockReport } = await import("../reportUnlocks");

      await unlockReport("user-123", "lead-1");
      await expect(unlockReport("user-123", "lead-1")).resolves.toBeUndefined();
    });

    it("throws if Supabase returns an error", async () => {
      fromMock.mockReturnValue({ upsert: upsertMock });
      upsertMock.mockResolvedValue({ error: { message: "db error" } });
      const { unlockReport } = await import("../reportUnlocks");

      await expect(unlockReport("user-123", "lead-1")).rejects.toThrow();
    });
  });

  describe("isReportUnlocked", () => {
    it("returns true when a matching row exists", async () => {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ eq: eqMock2 });
      eqMock2.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({ data: { user_id: "user-123" }, error: null });

      const { isReportUnlocked } = await import("../reportUnlocks");
      const result = await isReportUnlocked("user-123", "lead-1");

      expect(fromMock).toHaveBeenCalledWith("report_unlocks");
      expect(eqMock1).toHaveBeenCalledWith("user_id", "user-123");
      expect(eqMock2).toHaveBeenCalledWith("lead_id", "lead-1");
      expect(result).toBe(true);
    });

    it("returns false when no matching row exists", async () => {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ eq: eqMock2 });
      eqMock2.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const { isReportUnlocked } = await import("../reportUnlocks");
      const result = await isReportUnlocked("user-123", "lead-1");

      expect(result).toBe(false);
    });

    it("throws if Supabase returns an error", async () => {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ eq: eqMock2 });
      eqMock2.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({ data: null, error: { message: "db error" } });

      const { isReportUnlocked } = await import("../reportUnlocks");
      await expect(isReportUnlocked("user-123", "lead-1")).rejects.toThrow();
    });
  });
});
