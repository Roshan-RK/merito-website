import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

const markNotificationReadMock = vi.fn();
vi.mock("@/lib/hubNotifications", () => ({
  markNotificationRead: markNotificationReadMock,
}));

function requestFor() {
  return new Request("http://localhost/api/hub/notifications/n-1/read", { method: "POST" });
}

describe("POST /api/hub/notifications/[id]/read", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    markNotificationReadMock.mockReset();
    markNotificationReadMock.mockResolvedValue(undefined);
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("../route");

    const response = await POST(requestFor(), { params: Promise.resolve({ id: "n-1" }) });

    expect(response.status).toBe(401);
    expect(markNotificationReadMock).not.toHaveBeenCalled();
  });

  it("marks the notification read scoped to the signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await import("../route");

    const response = await POST(requestFor(), { params: Promise.resolve({ id: "n-1" }) });

    expect(response.status).toBe(200);
    expect(markNotificationReadMock).toHaveBeenCalledWith("n-1", "user-1");
  });
});
