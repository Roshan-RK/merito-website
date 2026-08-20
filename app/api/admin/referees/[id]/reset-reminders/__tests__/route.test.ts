import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const resetRefereeRemindersMock = vi.fn();
vi.mock("@/lib/referenceChecks", () => ({ resetRefereeReminders: resetRefereeRemindersMock }));

const logAdminActionMock = vi.fn();
vi.mock("@/lib/adminAuditLog", () => ({ logAdminAction: logAdminActionMock }));

describe("POST /api/admin/referees/[id]/reset-reminders", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    resetRefereeRemindersMock.mockReset();
    resetRefereeRemindersMock.mockResolvedValue(undefined);
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("resets and logs the action", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ id: "referee-1" }),
    });

    expect(response.status).toBe(200);
    expect(resetRefereeRemindersMock).toHaveBeenCalledWith("referee-1");
    expect(logAdminActionMock).toHaveBeenCalledWith({
      adminEmail: "roshan@merito.in",
      action: "referee.reset_reminders",
      targetType: "candidate",
      targetId: "referee-1",
      priorValue: null,
      newValue: { reminderCount: 0 },
    });
  });
});
