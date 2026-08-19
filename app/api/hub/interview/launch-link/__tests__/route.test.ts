import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

const reinviteInterviewCandidatesMock = vi.fn();
vi.mock("@/lib/intervuebox/invitations", () => ({
  reinviteInterviewCandidates: reinviteInterviewCandidatesMock,
}));

const maybeSingleMock = vi.fn();
const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
const eqRoleMock = vi.fn().mockReturnValue({ order: orderMock });
const eqUserMock = vi.fn().mockReturnValue({ eq: eqRoleMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock });

const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

const fromMock = vi.fn().mockReturnValue({ select: selectMock, update: updateMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importRoute() {
  return await import("../route");
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/hub/interview/launch-link", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/hub/interview/launch-link", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    reinviteInterviewCandidatesMock.mockReset();
    maybeSingleMock.mockReset();
    updateMock.mockClear();
    updateEqMock.mockClear();
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when there's no row for the role", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));
    expect(response.status).toBe(400);
  });

  it("returns 409 when the row is no longer invited (e.g. flipped to terminated)", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "terminated", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", magic_link: null, magic_link_expires_at: null },
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));
    expect(response.status).toBe(409);
    expect(reinviteInterviewCandidatesMock).not.toHaveBeenCalled();
  });

  it("returns the cached link with no vendor call when it hasn't expired", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", magic_link: "https://cached", magic_link_expires_at: future },
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://cached" });
    expect(reinviteInterviewCandidatesMock).not.toHaveBeenCalled();
  });

  it("mints a fresh link when the cached one is expired", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", magic_link: "https://stale", magic_link_expires_at: past },
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 1,
      failed: 0,
      magicLinks: [{ candidateId: "USR_1", magicLink: "https://fresh", expiresAt: "2026-08-20T10:00:00.000Z" }],
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://fresh" });
    expect(reinviteInterviewCandidatesMock).toHaveBeenCalledWith("INT_1", ["USR_1"]);
    expect(updateMock).toHaveBeenCalledWith({ magic_link: "https://fresh", magic_link_expires_at: "2026-08-20T10:00:00.000Z" });
  });

  it("returns a 502 JSON error (not a crash) when the vendor reinvite call throws, and doesn't update the row", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", magic_link: "https://stale", magic_link_expires_at: past },
    });
    reinviteInterviewCandidatesMock.mockRejectedValue(new Error("IntervueBox 500"));
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "IntervueBox rejected the reinvite request." });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("treats a null expiry as expired instead of throwing", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", magic_link: null, magic_link_expires_at: null },
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 1,
      failed: 0,
      magicLinks: [{ candidateId: "USR_1", magicLink: "https://fresh", expiresAt: "2026-08-20T10:00:00.000Z" }],
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));
    expect(response.status).toBe(200);
    expect(reinviteInterviewCandidatesMock).toHaveBeenCalled();
  });
});
