import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
const selectMock = vi.fn();
const eqMock1 = vi.fn();
const eqMock2 = vi.fn();
const maybeSingleMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const updateEqMock1 = vi.fn();
const updateEqMock2 = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("reportShareTokens", () => {
  beforeEach(() => {
    fromMock.mockReset();
    selectMock.mockReset();
    eqMock1.mockReset();
    eqMock2.mockReset();
    maybeSingleMock.mockReset();
    insertMock.mockReset();
    updateMock.mockReset();
    updateEqMock1.mockReset();
    updateEqMock2.mockReset();
  });

  describe("createOrUpdateShareLink", () => {
    it("inserts a new token row when none exists for the (user, role) pair", async () => {
      fromMock.mockReturnValue({ select: selectMock, insert: insertMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ eq: eqMock2 });
      eqMock2.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({ data: null, error: null });
      insertMock.mockResolvedValue({ error: null });
      const { createOrUpdateShareLink } = await import("../reportShareTokens");

      const result = await createOrUpdateShareLink({
        userId: "user-1",
        roleTitle: "Senior Product Manager",
        include: "fitment,interview",
        interviewSections: "scoreGauge",
      });

      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBe(64);
      const insertedRow = insertMock.mock.calls[0][0];
      expect(insertedRow.user_id).toBe("user-1");
      expect(insertedRow.role_title).toBe("Senior Product Manager");
      expect(insertedRow.token).toBe(result.token);
      expect(new Date(insertedRow.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it("updates the existing row in place, keeping the same token", async () => {
      fromMock.mockReturnValue({ select: selectMock, update: updateMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ eq: eqMock2 });
      eqMock2.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({ data: { token: "existing-token" }, error: null });
      updateMock.mockReturnValue({ eq: updateEqMock1 });
      updateEqMock1.mockResolvedValue({ error: null });
      const { createOrUpdateShareLink } = await import("../reportShareTokens");

      const result = await createOrUpdateShareLink({
        userId: "user-1",
        roleTitle: "Senior Product Manager",
        include: "fitment",
        interviewSections: "",
      });

      expect(result.token).toBe("existing-token");
      expect(updateEqMock1).toHaveBeenCalledWith("token", "existing-token");
      const updatedRow = updateMock.mock.calls[0][0];
      expect(updatedRow.include).toBe("fitment");
      expect(updatedRow.revoked_at).toBeNull();
      expect(new Date(updatedRow.expires_at).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("setShareLinkRevoked", () => {
    it("sets revoked_at when revoking", async () => {
      fromMock.mockReturnValue({ update: updateMock });
      updateMock.mockReturnValue({ eq: updateEqMock1 });
      updateEqMock1.mockReturnValue({ eq: updateEqMock2 });
      updateEqMock2.mockResolvedValue({ error: null });
      const { setShareLinkRevoked } = await import("../reportShareTokens");

      await setShareLinkRevoked({ userId: "user-1", roleTitle: "Senior Product Manager", revoked: true });

      const updatedRow = updateMock.mock.calls[0][0];
      expect(updatedRow.revoked_at).toBeTruthy();
    });

    it("clears revoked_at when un-revoking", async () => {
      fromMock.mockReturnValue({ update: updateMock });
      updateMock.mockReturnValue({ eq: updateEqMock1 });
      updateEqMock1.mockReturnValue({ eq: updateEqMock2 });
      updateEqMock2.mockResolvedValue({ error: null });
      const { setShareLinkRevoked } = await import("../reportShareTokens");

      await setShareLinkRevoked({ userId: "user-1", roleTitle: "Senior Product Manager", revoked: false });

      const updatedRow = updateMock.mock.calls[0][0];
      expect(updatedRow.revoked_at).toBeNull();
    });
  });

  describe("validateShareToken", () => {
    it("returns valid:false reason:not_found when no row matches", async () => {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({ data: null, error: null });
      const { validateShareToken } = await import("../reportShareTokens");

      const result = await validateShareToken("missing");
      expect(result).toEqual({ valid: false, reason: "not_found" });
    });

    it("returns valid:false reason:revoked when revoked_at is set", async () => {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({
        data: { user_id: "user-1", role_title: "Senior Product Manager", include: "fitment", interview_sections: "", revoked_at: new Date().toISOString() },
        error: null,
      });
      const { validateShareToken } = await import("../reportShareTokens");

      const result = await validateShareToken("revoked-token");
      expect(result).toEqual({ valid: false, reason: "revoked" });
    });

    it("returns valid:false reason:expired when expires_at is in the past", async () => {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({
        data: {
          user_id: "user-1",
          role_title: "Senior Product Manager",
          include: "fitment",
          interview_sections: "",
          revoked_at: null,
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
        error: null,
      });
      const { validateShareToken } = await import("../reportShareTokens");

      const result = await validateShareToken("expired-token");
      expect(result).toEqual({ valid: false, reason: "expired" });
    });

    it("returns valid:true with parsed include/interviewSections for a live token", async () => {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({
        data: {
          user_id: "user-1",
          role_title: "Senior Product Manager",
          include: "fitment,interview",
          interview_sections: "scoreGauge,overview",
          revoked_at: null,
          expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        },
        error: null,
      });
      const { validateShareToken } = await import("../reportShareTokens");

      const result = await validateShareToken("good-token");
      expect(result).toEqual({
        valid: true,
        userId: "user-1",
        roleTitle: "Senior Product Manager",
        include: ["fitment", "interview"],
        interviewSections: ["scoreGauge", "overview"],
      });
    });
  });
});
