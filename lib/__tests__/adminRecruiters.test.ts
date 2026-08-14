import { describe, it, expect, vi, beforeEach } from "vitest";

const logAdminActionMock = vi.fn();
vi.mock("@/lib/adminAuditLog", () => ({ logAdminAction: logAdminActionMock }));

const updateMock = vi.fn();
const updateEqMock = vi.fn();
const selectMock = vi.fn();
const selectEqMock = vi.fn();
const selectMaybeSingleMock = vi.fn();
const selectOrderMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("lib/adminRecruiters", () => {
  beforeEach(() => {
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
    updateMock.mockReset();
    updateEqMock.mockReset();
    updateEqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: updateEqMock });
    selectMock.mockReset();
    selectEqMock.mockReset();
    selectMaybeSingleMock.mockReset();
    selectOrderMock.mockReset();
    fromMock.mockReset();
    fromMock.mockReturnValue({
      update: updateMock,
      select: selectMock,
    });
    selectMock.mockReturnValue({ eq: selectEqMock, order: selectOrderMock });
    selectEqMock.mockReturnValue({ maybeSingle: selectMaybeSingleMock });
  });

  describe("banRecruiter", () => {
    it("sets banned_at and logs the action", async () => {
      const { banRecruiter } = await import("../adminRecruiters");

      await banRecruiter("recruiter@company.com", "rushi.humbe@gmail.com", "abuse");

      expect(fromMock).toHaveBeenCalledWith("recruiter_identities");
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ banned_at: expect.any(String) }));
      expect(updateEqMock).toHaveBeenCalledWith("email", "recruiter@company.com");
      expect(logAdminActionMock).toHaveBeenCalledWith({
        adminEmail: "rushi.humbe@gmail.com",
        action: "recruiter.ban",
        targetType: "recruiter",
        targetId: "recruiter@company.com",
        priorValue: null,
        newValue: { banned: true, reason: "abuse" },
      });
    });

    it("throws when the update fails", async () => {
      updateEqMock.mockResolvedValue({ error: { message: "db error" } });
      const { banRecruiter } = await import("../adminRecruiters");

      await expect(banRecruiter("recruiter@company.com", "rushi.humbe@gmail.com", "abuse")).rejects.toThrow(
        "Failed to ban recruiter: db error"
      );
      expect(logAdminActionMock).not.toHaveBeenCalled();
    });
  });

  describe("unbanRecruiter", () => {
    it("clears banned_at and logs the action", async () => {
      const { unbanRecruiter } = await import("../adminRecruiters");

      await unbanRecruiter("recruiter@company.com", "rushi.humbe@gmail.com");

      expect(updateMock).toHaveBeenCalledWith({ banned_at: null });
      expect(logAdminActionMock).toHaveBeenCalledWith({
        adminEmail: "rushi.humbe@gmail.com",
        action: "recruiter.unban",
        targetType: "recruiter",
        targetId: "recruiter@company.com",
        priorValue: { banned: true },
        newValue: { banned: false },
      });
    });
  });

  describe("unverifyRecruiter", () => {
    it("clears verified_at and logs the action", async () => {
      const { unverifyRecruiter } = await import("../adminRecruiters");

      await unverifyRecruiter("recruiter@company.com", "rushi.humbe@gmail.com");

      expect(updateMock).toHaveBeenCalledWith({ verified_at: null });
      expect(logAdminActionMock).toHaveBeenCalledWith({
        adminEmail: "rushi.humbe@gmail.com",
        action: "recruiter.unverify",
        targetType: "recruiter",
        targetId: "recruiter@company.com",
        priorValue: { verified: true },
        newValue: { verified: false },
      });
    });
  });

  describe("updateRecruiterCompany", () => {
    it("updates company_name and logs prior/new value", async () => {
      selectMaybeSingleMock.mockResolvedValue({ data: { company_name: "Old Co" }, error: null });
      const { updateRecruiterCompany } = await import("../adminRecruiters");

      await updateRecruiterCompany("recruiter@company.com", "New Co", "rushi.humbe@gmail.com");

      expect(updateMock).toHaveBeenCalledWith({ company_name: "New Co" });
      expect(logAdminActionMock).toHaveBeenCalledWith({
        adminEmail: "rushi.humbe@gmail.com",
        action: "recruiter.update_company",
        targetType: "recruiter",
        targetId: "recruiter@company.com",
        priorValue: { companyName: "Old Co" },
        newValue: { companyName: "New Co" },
      });
    });
  });

  describe("listRecruiters", () => {
    it("maps rows to RecruiterRow", async () => {
      selectOrderMock.mockResolvedValue({
        data: [{ email: "a@b.com", company_name: "Acme", verified_at: "2026-08-01T00:00:00Z", banned_at: null }],
        error: null,
      });
      const { listRecruiters } = await import("../adminRecruiters");

      const rows = await listRecruiters();

      expect(rows).toEqual([
        { email: "a@b.com", companyName: "Acme", verifiedAt: "2026-08-01T00:00:00Z", bannedAt: null },
      ]);
    });
  });
});
