import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

const getAllNotificationsMock = vi.fn();
const getUnreadNotificationsMock = vi.fn();
vi.mock("@/lib/hubNotifications", () => ({
  getAllNotifications: getAllNotificationsMock,
  getUnreadNotifications: getUnreadNotificationsMock,
}));

describe("GET /api/hub/notifications", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getAllNotificationsMock.mockReset();
    getUnreadNotificationsMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("../route");

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getAllNotificationsMock).not.toHaveBeenCalled();
  });

  it("returns the recent list plus the unread count", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getAllNotificationsMock.mockResolvedValue([
      { id: "n-1", message: "hi", createdAt: "2026-08-17T00:00:00.000Z", readAt: null },
    ]);
    getUnreadNotificationsMock.mockResolvedValue([
      { id: "n-1", message: "hi", createdAt: "2026-08-17T00:00:00.000Z", readAt: null },
    ]);
    const { GET } = await import("../route");

    const response = await GET();
    const body = await response.json();

    expect(getAllNotificationsMock).toHaveBeenCalledWith("user-1", 20);
    expect(getUnreadNotificationsMock).toHaveBeenCalledWith("user-1");
    expect(body.unreadCount).toBe(1);
    expect(body.notifications).toHaveLength(1);
  });
});
