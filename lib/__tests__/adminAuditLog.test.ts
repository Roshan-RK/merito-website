import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const countSelectMock = vi.fn();
const dataSelectMock = vi.fn();
const orderMock = vi.fn();
const rangeMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("logAdminAction", () => {
  beforeEach(() => {
    fromMock.mockReset();
    fromMock.mockReturnValue({ insert: insertMock });
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
  });

  it("inserts a row into admin_audit_log with the given fields", async () => {
    const { logAdminAction } = await import("../adminAuditLog");

    await logAdminAction({
      adminEmail: "roshan@merito.in",
      action: "candidate.ban",
      targetType: "candidate",
      targetId: "user-1",
      priorValue: null,
      newValue: { banned: true, reason: "spam" },
    });

    expect(fromMock).toHaveBeenCalledWith("admin_audit_log");
    expect(insertMock).toHaveBeenCalledWith({
      admin_email: "roshan@merito.in",
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
        adminEmail: "roshan@merito.in",
        action: "candidate.ban",
        targetType: "candidate",
        targetId: "user-1",
      })
    ).rejects.toThrow("Failed to write admin audit log: db error");
  });
});

describe("listAdminActions", () => {
  beforeEach(() => {
    fromMock.mockReset();
    countSelectMock.mockReset();
    dataSelectMock.mockReset();
    orderMock.mockReset();
    rangeMock.mockReset();

    fromMock.mockReturnValueOnce({ select: countSelectMock }).mockReturnValueOnce({ select: dataSelectMock });
    dataSelectMock.mockReturnValue({ order: orderMock });
    orderMock.mockReturnValue({ range: rangeMock });
  });

  it("returns mapped rows with pagination metadata", async () => {
    countSelectMock.mockResolvedValue({ count: 25, error: null });
    rangeMock.mockResolvedValue({
      data: [
        {
          id: "log-1",
          admin_email: "admin@merito.in",
          action: "candidate.ban",
          target_type: "candidate",
          target_id: "user-1",
          prior_value: null,
          new_value: { banned: true },
          created_at: "2026-08-20T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const { listAdminActions } = await import("../adminAuditLog");

    const result = await listAdminActions(2);

    expect(rangeMock).toHaveBeenCalledWith(20, 39);
    expect(result).toEqual({
      rows: [
        {
          id: "log-1",
          adminEmail: "admin@merito.in",
          action: "candidate.ban",
          targetType: "candidate",
          targetId: "user-1",
          priorValue: null,
          newValue: { banned: true },
          createdAt: "2026-08-20T10:00:00.000Z",
        },
      ],
      total: 25,
      totalPages: 2,
      page: 2,
    });
  });

  it("clamps an out-of-range page down to the last page", async () => {
    countSelectMock.mockResolvedValue({ count: 5, error: null });
    rangeMock.mockResolvedValue({ data: [], error: null });
    const { listAdminActions } = await import("../adminAuditLog");

    const result = await listAdminActions(99);

    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("defaults to an empty page when there are no rows", async () => {
    countSelectMock.mockResolvedValue({ count: 0, error: null });
    rangeMock.mockResolvedValue({ data: null, error: null });
    const { listAdminActions } = await import("../adminAuditLog");

    const result = await listAdminActions();

    expect(result).toEqual({ rows: [], total: 0, totalPages: 1, page: 1 });
  });
});

describe("getAdminActivityStats", () => {
  const gteMock = vi.fn();

  beforeEach(() => {
    fromMock.mockReset();
    gteMock.mockReset();
    fromMock.mockReturnValue({ select: () => ({ gte: gteMock }) });
  });

  it("returns counts for the last 24h, 7d, and 30d windows", async () => {
    gteMock.mockResolvedValueOnce({ count: 2, error: null }).mockResolvedValueOnce({ count: 9, error: null }).mockResolvedValueOnce({ count: 40, error: null });
    const { getAdminActivityStats } = await import("../adminAuditLog");

    const result = await getAdminActivityStats();

    expect(result).toEqual({ last24h: 2, last7d: 9, last30d: 40 });
  });

  it("treats a null count as zero", async () => {
    gteMock.mockResolvedValue({ count: null, error: null });
    const { getAdminActivityStats } = await import("../adminAuditLog");

    const result = await getAdminActivityStats();

    expect(result).toEqual({ last24h: 0, last7d: 0, last30d: 0 });
  });
});

describe("listActionsForTarget", () => {
  const eqMock = vi.fn();
  const targetOrderMock = vi.fn();

  beforeEach(() => {
    fromMock.mockReset();
    eqMock.mockReset();
    targetOrderMock.mockReset();
    fromMock.mockReturnValue({ select: () => ({ eq: eqMock }) });
    eqMock.mockReturnValue({ eq: () => ({ order: targetOrderMock }) });
  });

  it("returns all mapped rows for the target, unpaginated", async () => {
    targetOrderMock.mockResolvedValue({
      data: [
        {
          id: "log-1",
          admin_email: "roshan@merito.in",
          action: "candidate.recruiter_preview_override",
          target_type: "candidate",
          target_id: "user-1",
          prior_value: { enabled: false },
          new_value: { enabled: true, reason: "x" },
          created_at: "2026-08-20T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const { listActionsForTarget } = await import("../adminAuditLog");

    const result = await listActionsForTarget("candidate", "user-1");

    expect(fromMock).toHaveBeenCalledWith("admin_audit_log");
    expect(result).toEqual([
      {
        id: "log-1",
        adminEmail: "roshan@merito.in",
        action: "candidate.recruiter_preview_override",
        targetType: "candidate",
        targetId: "user-1",
        priorValue: { enabled: false },
        newValue: { enabled: true, reason: "x" },
        createdAt: "2026-08-20T10:00:00.000Z",
      },
    ]);
  });

  it("returns an empty array when there are no rows", async () => {
    targetOrderMock.mockResolvedValue({ data: null, error: null });
    const { listActionsForTarget } = await import("../adminAuditLog");

    const result = await listActionsForTarget("candidate", "user-1");

    expect(result).toEqual([]);
  });
});
