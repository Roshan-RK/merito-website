import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const broadcastCandidateNotificationMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ broadcastCandidateNotification: broadcastCandidateNotificationMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/notifications/broadcast", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/notifications/broadcast", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    broadcastCandidateNotificationMock.mockReset();
    broadcastCandidateNotificationMock.mockResolvedValue({ sent: 3, failed: 0 });
  });

  it("sends with defaulted filters and category, returns sent/failed", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ message: "Hello all" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ sent: 3, failed: 0 });
    expect(broadcastCandidateNotificationMock).toHaveBeenCalledWith({ funnelStages: [], roleTitles: [] }, "Hello all", "general", "roshan@merito.in");
  });

  it("passes explicit filters and category through", async () => {
    const { POST } = await import("../route");

    await POST(
      buildRequest({
        funnelStages: ["report_unlocked"],
        roleTitles: ["Product Manager"],
        message: "Report ready",
        category: "report",
      })
    );

    expect(broadcastCandidateNotificationMock).toHaveBeenCalledWith(
      { funnelStages: ["report_unlocked"], roleTitles: ["Product Manager"] },
      "Report ready",
      "report",
      "roshan@merito.in"
    );
  });

  it("returns 400 when message is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
    expect(broadcastCandidateNotificationMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid funnel stage", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ funnelStages: ["not_a_stage"], message: "hi" }));

    expect(response.status).toBe(400);
    expect(broadcastCandidateNotificationMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the send throws", async () => {
    broadcastCandidateNotificationMock.mockRejectedValue(new Error("Failed to list users: boom"));
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ message: "hi" }));

    expect(response.status).toBe(409);
  });
});
