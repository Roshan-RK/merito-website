import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const sendCandidateNotificationMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ sendCandidateNotification: sendCandidateNotificationMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/candidates/user-1/notify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/candidates/[userId]/notify", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
    sendCandidateNotificationMock.mockReset();
    sendCandidateNotificationMock.mockResolvedValue(undefined);
  });

  it("sends the notification and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ message: "Your report is ready." }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(200);
    expect(sendCandidateNotificationMock).toHaveBeenCalledWith("user-1", "Your report is ready.", "rushi.humbe@gmail.com");
  });

  it("returns 400 when message is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({}), { params: Promise.resolve({ userId: "user-1" }) });

    expect(response.status).toBe(400);
    expect(sendCandidateNotificationMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the insert fails", async () => {
    sendCandidateNotificationMock.mockRejectedValue(new Error("Failed to send notification: db error"));
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ message: "hi" }), { params: Promise.resolve({ userId: "user-1" }) });

    expect(response.status).toBe(409);
  });
});
