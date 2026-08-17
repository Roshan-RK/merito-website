import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

const markAllNotificationsReadMock = vi.fn();
vi.mock("@/lib/hubNotifications", () => ({
  markAllNotificationsRead: markAllNotificationsReadMock,
}));

describe("POST /api/hub/notifications/mark-all-read", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    markAllNotificationsReadMock.mockReset();
    markAllNotificationsReadMock.mockResolvedValue(undefined);
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("../route");

    const response = await POST();

    expect(response.status).toBe(401);
    expect(markAllNotificationsReadMock).not.toHaveBeenCalled();
  });

  it("marks every notification read for the signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await import("../route");

    const response = await POST();

    expect(response.status).toBe(200);
    expect(markAllNotificationsReadMock).toHaveBeenCalledWith("user-1");
  });
});
