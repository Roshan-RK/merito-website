import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const resolveBroadcastAudienceMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ resolveBroadcastAudience: resolveBroadcastAudienceMock }));

function buildRequest(query: string) {
  return new Request(`http://localhost/api/admin/notifications/broadcast/preview${query}`);
}

describe("GET /api/admin/notifications/broadcast/preview", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    resolveBroadcastAudienceMock.mockReset();
  });

  it("returns the filtered count and unfiltered role title options", async () => {
    resolveBroadcastAudienceMock
      .mockResolvedValueOnce([{ userId: "user-0", latestRoleTitle: "Product Manager" }])
      .mockResolvedValueOnce([
        { userId: "user-0", latestRoleTitle: "Product Manager" },
        { userId: "user-1", latestRoleTitle: "Software Engineer" },
      ]);
    const { GET } = await import("../route");

    const response = await GET(buildRequest("?funnelStage=report_unlocked"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.roleTitleOptions.sort()).toEqual(["Product Manager", "Software Engineer"]);
    expect(resolveBroadcastAudienceMock).toHaveBeenNthCalledWith(1, { funnelStages: ["report_unlocked"], roleTitles: [] });
    expect(resolveBroadcastAudienceMock).toHaveBeenNthCalledWith(2, {});
  });

  it("ignores an invalid funnel stage query param", async () => {
    resolveBroadcastAudienceMock.mockResolvedValue([]);
    const { GET } = await import("../route");

    const response = await GET(buildRequest("?funnelStage=not_a_stage"));

    expect(response.status).toBe(200);
    expect(resolveBroadcastAudienceMock).toHaveBeenNthCalledWith(1, { funnelStages: [], roleTitles: [] });
  });

  it("passes multiple role title params through", async () => {
    resolveBroadcastAudienceMock.mockResolvedValue([]);
    const { GET } = await import("../route");

    await GET(buildRequest("?roleTitle=Product+Manager&roleTitle=Software+Engineer"));

    expect(resolveBroadcastAudienceMock).toHaveBeenNthCalledWith(1, { funnelStages: [], roleTitles: ["Product Manager", "Software Engineer"] });
  });
});
