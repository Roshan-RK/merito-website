import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const resolveBroadcastAudienceMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({
  resolveBroadcastAudience: resolveBroadcastAudienceMock,
  FUNNEL_STAGES: ["fitment_started", "report_unlocked", "interview_ready", "personality_completed", "reference_completed"],
}));

function buildRequest(query: string) {
  return new Request(`http://localhost/api/admin/notifications/broadcast/preview${query}`);
}

// Unfiltered audience the route resolves exactly once. Deliberately mixed
// funnel stages / role titles so filtered-count assertions are unambiguous.
const ALL_CANDIDATES = [
  { userId: "user-0", funnelStage: "fitment_started", latestRoleTitle: "Product Manager" },
  { userId: "user-1", funnelStage: "report_unlocked", latestRoleTitle: "Product Manager" },
  { userId: "user-2", funnelStage: "report_unlocked", latestRoleTitle: "Software Engineer" },
];

describe("GET /api/admin/notifications/broadcast/preview", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    resolveBroadcastAudienceMock.mockReset();
    resolveBroadcastAudienceMock.mockResolvedValue(ALL_CANDIDATES);
  });

  it("resolves the audience once and returns the in-memory filtered count", async () => {
    const { GET } = await import("../route");

    const response = await GET(buildRequest("?funnelStage=report_unlocked"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(2); // user-1, user-2
    expect(resolveBroadcastAudienceMock).toHaveBeenCalledTimes(1);
    expect(resolveBroadcastAudienceMock).toHaveBeenCalledWith({});
  });

  it("computes role title options from the full unfiltered audience, unaffected by the stage filter", async () => {
    const { GET } = await import("../route");

    const response = await GET(buildRequest("?funnelStage=report_unlocked"));
    const data = await response.json();

    expect(data.roleTitleOptions.sort()).toEqual(["Product Manager", "Software Engineer"]);
  });

  it("ignores an invalid funnel stage query param (no restriction applied)", async () => {
    const { GET } = await import("../route");

    const response = await GET(buildRequest("?funnelStage=not_a_stage"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(3); // invalid stage dropped -> no stage filter -> all 3 match
    expect(resolveBroadcastAudienceMock).toHaveBeenCalledTimes(1);
    expect(resolveBroadcastAudienceMock).toHaveBeenCalledWith({});
  });

  it("filters the count by role title without a second resolveBroadcastAudience call", async () => {
    const { GET } = await import("../route");

    const response = await GET(buildRequest("?roleTitle=Software+Engineer"));
    const data = await response.json();

    expect(data.count).toBe(1); // only user-2
    expect(resolveBroadcastAudienceMock).toHaveBeenCalledTimes(1);
    expect(resolveBroadcastAudienceMock).toHaveBeenCalledWith({});
  });

  it("combines stage and role filters", async () => {
    const { GET } = await import("../route");

    const response = await GET(buildRequest("?funnelStage=report_unlocked&roleTitle=Product+Manager"));
    const data = await response.json();

    expect(data.count).toBe(1); // only user-1 matches both
  });
});
