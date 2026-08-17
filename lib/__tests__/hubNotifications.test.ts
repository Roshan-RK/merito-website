import { describe, it, expect, vi, beforeEach } from "vitest";

const selectMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: () => ({ select: selectMock, update: updateMock }),
  }),
}));

describe("getUnreadNotifications", () => {
  const orderMock = vi.fn();
  const isMock = vi.fn().mockReturnValue({ order: orderMock });
  const eqMock = vi.fn().mockReturnValue({ is: isMock });

  beforeEach(() => {
    selectMock.mockReset();
    selectMock.mockReturnValue({ eq: eqMock });
    orderMock.mockReset();
  });

  it("returns only unread rows, mapped to camelCase", async () => {
    orderMock.mockResolvedValue({
      data: [{ id: "n-1", message: "hi", created_at: "2026-08-17T00:00:00.000Z", read_at: null }],
      error: null,
    });
    const { getUnreadNotifications } = await import("../hubNotifications");

    const result = await getUnreadNotifications("user-1");

    expect(eqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(isMock).toHaveBeenCalledWith("read_at", null);
    expect(result).toEqual([{ id: "n-1", message: "hi", createdAt: "2026-08-17T00:00:00.000Z", readAt: null }]);
  });

  it("throws on a query error", async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: "db error" } });
    const { getUnreadNotifications } = await import("../hubNotifications");

    await expect(getUnreadNotifications("user-1")).rejects.toThrow("Failed to load unread notifications: db error");
  });
});

describe("getAllNotifications", () => {
  const limitMock = vi.fn();
  const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
  const eqMock = vi.fn().mockReturnValue({ order: orderMock });

  beforeEach(() => {
    selectMock.mockReset();
    selectMock.mockReturnValue({ eq: eqMock });
    limitMock.mockReset();
  });

  it("returns rows up to the given limit", async () => {
    limitMock.mockResolvedValue({
      data: [{ id: "n-1", message: "hi", created_at: "2026-08-17T00:00:00.000Z", read_at: "2026-08-17T01:00:00.000Z" }],
      error: null,
    });
    const { getAllNotifications } = await import("../hubNotifications");

    const result = await getAllNotifications("user-1", 5);

    expect(limitMock).toHaveBeenCalledWith(5);
    expect(result).toEqual([
      { id: "n-1", message: "hi", createdAt: "2026-08-17T00:00:00.000Z", readAt: "2026-08-17T01:00:00.000Z" },
    ]);
  });

  it("defaults the limit to 20", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });
    const { getAllNotifications } = await import("../hubNotifications");

    await getAllNotifications("user-1");

    expect(limitMock).toHaveBeenCalledWith(20);
  });
});

describe("markNotificationRead", () => {
  const eqUserMock = vi.fn();
  const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock });

  beforeEach(() => {
    updateMock.mockReset();
    updateMock.mockReturnValue({ eq: eqIdMock });
    eqUserMock.mockReset();
  });

  it("scopes the update to both the notification id and the owning user", async () => {
    eqUserMock.mockResolvedValue({ error: null });
    const { markNotificationRead } = await import("../hubNotifications");

    await markNotificationRead("n-1", "user-1");

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ read_at: expect.any(String) }));
    expect(eqIdMock).toHaveBeenCalledWith("id", "n-1");
    expect(eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("throws on a query error", async () => {
    eqUserMock.mockResolvedValue({ error: { message: "db error" } });
    const { markNotificationRead } = await import("../hubNotifications");

    await expect(markNotificationRead("n-1", "user-1")).rejects.toThrow("Failed to mark notification read: db error");
  });
});

describe("markAllNotificationsRead", () => {
  const isMock = vi.fn();
  const eqMock = vi.fn().mockReturnValue({ is: isMock });

  beforeEach(() => {
    updateMock.mockReset();
    updateMock.mockReturnValue({ eq: eqMock });
    isMock.mockReset();
  });

  it("marks every unread row for the user as read", async () => {
    isMock.mockResolvedValue({ error: null });
    const { markAllNotificationsRead } = await import("../hubNotifications");

    await markAllNotificationsRead("user-1");

    expect(eqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(isMock).toHaveBeenCalledWith("read_at", null);
  });

  it("throws on a query error", async () => {
    isMock.mockResolvedValue({ error: { message: "db error" } });
    const { markAllNotificationsRead } = await import("../hubNotifications");

    await expect(markAllNotificationsRead("user-1")).rejects.toThrow("Failed to mark notifications read: db error");
  });
});
