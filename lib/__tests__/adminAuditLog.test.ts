import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("logAdminAction", () => {
  beforeEach(() => {
    fromMock.mockClear();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
  });

  it("inserts a row into admin_audit_log with the given fields", async () => {
    const { logAdminAction } = await import("../adminAuditLog");

    await logAdminAction({
      adminEmail: "rushi.humbe@gmail.com",
      action: "candidate.ban",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: null,
      newValue: { banned: true, reason: "spam" },
    });

    expect(fromMock).toHaveBeenCalledWith("admin_audit_log");
    expect(insertMock).toHaveBeenCalledWith({
      admin_email: "rushi.humbe@gmail.com",
      action: "candidate.ban",
      target_type: "candidate",
      target_id: "user-1",
      prior_value: null,
      new_value: { banned: true, reason: "spam" },
    });
  });

  it("throws when the insert fails", async () => {
    insertMock.mockResolvedValue({ error: { message: "db error" } });
    const { logAdminAction } = await import("../adminAuditLog");

    await expect(
      logAdminAction({
        adminEmail: "rushi.humbe@gmail.com",
        action: "candidate.ban",
        targetType: "candidate",
        targetId: "user-1",
      })
    ).rejects.toThrow("Failed to write admin audit log: db error");
  });
});
