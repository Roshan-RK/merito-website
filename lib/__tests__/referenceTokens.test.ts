import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const maybeSingleMock = vi.fn();
const updateMock = vi.fn();
const updateEqMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("referenceTokens", () => {
  beforeEach(() => {
    fromMock.mockReset();
    insertMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    maybeSingleMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();
    delete process.env.REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS;
  });

  describe("createRefereeToken", () => {
    it("inserts a token row with a future expiry and returns the token", async () => {
      fromMock.mockReturnValue({ insert: insertMock });
      insertMock.mockResolvedValue({ error: null });
      const { createRefereeToken } = await import("../referenceTokens");

      const token = await createRefereeToken("referee-1");

      expect(fromMock).toHaveBeenCalledWith("reference_tokens");
      expect(typeof token).toBe("string");
      expect(token.length).toBe(64); // 32 bytes hex-encoded
      const insertedRow = insertMock.mock.calls[0][0];
      expect(insertedRow.reference_id).toBe("referee-1");
      expect(insertedRow.token).toBe(token);
      expect(new Date(insertedRow.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it("throws if Supabase returns an error", async () => {
      fromMock.mockReturnValue({ insert: insertMock });
      insertMock.mockResolvedValue({ error: { message: "db error" } });
      const { createRefereeToken } = await import("../referenceTokens");

      await expect(createRefereeToken("referee-1")).rejects.toThrow();
    });
  });

  describe("validateRefereeToken", () => {
    function mockLookup(result: { data: unknown; error: unknown }) {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock });
      eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue(result);
    }

    it("returns valid:false reason:not_found when no row matches", async () => {
      mockLookup({ data: null, error: null });
      const { validateRefereeToken } = await import("../referenceTokens");

      const result = await validateRefereeToken("missing-token");
      expect(result).toEqual({ valid: false, reason: "not_found" });
    });

    it("returns valid:false reason:used when used_at is set", async () => {
      mockLookup({
        data: { reference_id: "referee-1", expires_at: new Date(Date.now() + 100000).toISOString(), used_at: new Date().toISOString() },
        error: null,
      });
      const { validateRefereeToken } = await import("../referenceTokens");

      const result = await validateRefereeToken("used-token");
      expect(result).toEqual({ valid: false, reason: "used" });
    });

    it("returns valid:false reason:expired when expires_at is in the past", async () => {
      mockLookup({
        data: { reference_id: "referee-1", expires_at: new Date(Date.now() - 1000).toISOString(), used_at: null },
        error: null,
      });
      const { validateRefereeToken } = await import("../referenceTokens");

      const result = await validateRefereeToken("expired-token");
      expect(result).toEqual({ valid: false, reason: "expired" });
    });

    it("returns valid:true with refereeId for a live, unused token", async () => {
      mockLookup({
        data: { reference_id: "referee-1", expires_at: new Date(Date.now() + 100000).toISOString(), used_at: null },
        error: null,
      });
      const { validateRefereeToken } = await import("../referenceTokens");

      const result = await validateRefereeToken("good-token");
      expect(result).toEqual({ valid: true, refereeId: "referee-1" });
    });
  });

  describe("consumeRefereeToken", () => {
    it("sets used_at on the matching token row", async () => {
      fromMock.mockReturnValue({ update: updateMock });
      updateMock.mockReturnValue({ eq: updateEqMock });
      updateEqMock.mockResolvedValue({ error: null });
      const { consumeRefereeToken } = await import("../referenceTokens");

      await consumeRefereeToken("good-token");

      expect(fromMock).toHaveBeenCalledWith("reference_tokens");
      expect(updateEqMock).toHaveBeenCalledWith("token", "good-token");
      const updatedRow = updateMock.mock.calls[0][0];
      expect(updatedRow.used_at).toBeTruthy();
    });

    it("throws if Supabase returns an error", async () => {
      fromMock.mockReturnValue({ update: updateMock });
      updateMock.mockReturnValue({ eq: updateEqMock });
      updateEqMock.mockResolvedValue({ error: { message: "db error" } });
      const { consumeRefereeToken } = await import("../referenceTokens");

      await expect(consumeRefereeToken("good-token")).rejects.toThrow();
    });
  });
});
