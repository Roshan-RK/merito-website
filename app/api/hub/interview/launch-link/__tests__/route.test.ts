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
const eqLeadIdMock = vi.fn().mockReturnValue({ order: orderMock });
const eqUserMock = vi.fn().mockReturnValue({ eq: eqLeadIdMock });
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
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when there's no row for the role", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(400);
  });

  it("returns 409 when the row is no longer invited (e.g. flipped to terminated)", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "terminated", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", magic_link: null, magic_link_expires_at: null },
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(409);
    expect(reinviteInterviewCandidatesMock).not.toHaveBeenCalled();
  });

  it("returns the cached link with no vendor call when it hasn't expired", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", magic_link: "https://cached", magic_link_expires_at: future },
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://cached" });
    expect(reinviteInterviewCandidatesMock).not.toHaveBeenCalled();
  });

  it("mints a fresh link when the cached one is expired, and clears the fail counter", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", magic_link: "https://stale", magic_link_expires_at: past, has_resumed: false, launch_fail_count: 1 },
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 1,
      failed: 0,
      magicLinks: [{ candidateId: "USR_1", magicLink: "https://fresh", expiresAt: "2026-08-20T10:00:00.000Z" }],
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://fresh" });
    expect(reinviteInterviewCandidatesMock).toHaveBeenCalledWith("INT_1", ["USR_1"], "REINVITE");
    expect(updateMock).toHaveBeenCalledWith({ magic_link: "https://fresh", magic_link_expires_at: "2026-08-20T10:00:00.000Z", launch_fail_count: 0 });
  });

  it("skips the cache and asks for a fresh RESUME link when the row has ever been resumed, even if the cached link hasn't expired", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "row-1",
        status: "invited",
        ib_agent_id: "INT_1",
        ib_candidate_id: "USR_1",
        magic_link: "https://stale-cached-after-resume",
        magic_link_expires_at: future,
        has_resumed: true,
      },
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 1,
      failed: 0,
      magicLinks: [{ candidateId: "USR_1", magicLink: "https://fresh-resume", expiresAt: "2026-08-20T10:00:00.000Z" }],
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://fresh-resume" });
    expect(reinviteInterviewCandidatesMock).toHaveBeenCalledWith("INT_1", ["USR_1"], "RESUME");
  });

  it("surfaces the vendor's real rejection reason when a resumed row's link comes back dead", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "row-1",
        status: "invited",
        ib_agent_id: "INT_1",
        ib_candidate_id: "USR_1",
        magic_link: "https://dead",
        magic_link_expires_at: future,
        has_resumed: true,
        launch_fail_count: 0,
      },
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 0,
      failed: 1,
      errors: [{ candidateId: "USR_1", error: "Cannot resume an interview in status EVALUATED" }],
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Cannot resume an interview in status EVALUATED" });
  });

  it("returns a 502 JSON error (not a crash) when the vendor reinvite call throws, and caches no link", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", magic_link: "https://stale", magic_link_expires_at: past, has_resumed: false, launch_fail_count: 0 },
    });
    reinviteInterviewCandidatesMock.mockRejectedValue(new Error("IntervueBox 500"));
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "IntervueBox rejected the reinvite request." });
    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ magic_link: expect.anything() }));
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
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(200);
    expect(reinviteInterviewCandidatesMock).toHaveBeenCalled();
  });

  it("sets stuck_at when a resumed row's fresh reinvite call throws", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "row-1",
        status: "invited",
        ib_agent_id: "INT_1",
        ib_candidate_id: "USR_1",
        magic_link: "https://dead",
        magic_link_expires_at: future,
        has_resumed: true,
        launch_fail_count: 0,
      },
    });
    reinviteInterviewCandidatesMock.mockRejectedValue(new Error("IntervueBox 500"));
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(502);
    expect(updateMock).toHaveBeenCalledWith({ stuck_at: expect.any(String) });
  });

  it("sets stuck_at when a resumed row's fresh reinvite call returns no magicLinks", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "row-1",
        status: "invited",
        ib_agent_id: "INT_1",
        ib_candidate_id: "USR_1",
        magic_link: "https://dead",
        magic_link_expires_at: future,
        has_resumed: true,
        launch_fail_count: 0,
      },
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 0,
      failed: 1,
      errors: [{ candidateId: "USR_1", error: "Cannot resume an interview in status EVALUATED" }],
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(502);
    expect(updateMock).toHaveBeenCalledWith({ stuck_at: expect.any(String) });
  });

  it("bumps launch_fail_count to 1 without escalating when a first-timer's vendor call throws", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "row-1",
        status: "invited",
        ib_agent_id: "INT_1",
        ib_candidate_id: "USR_1",
        magic_link: "https://stale",
        magic_link_expires_at: past,
        has_resumed: false,
        launch_fail_count: 0,
      },
    });
    reinviteInterviewCandidatesMock.mockRejectedValue(new Error("IntervueBox 500"));
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(502);
    expect(updateMock).toHaveBeenCalledWith({ launch_fail_count: 1 });
    expect(updateMock).not.toHaveBeenCalledWith({ stuck_at: expect.any(String) });
  });

  it("bumps launch_fail_count to 1 without escalating when a first-timer's reinvite returns no magicLinks", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "row-1",
        status: "invited",
        ib_agent_id: "INT_1",
        ib_candidate_id: "USR_1",
        magic_link: "https://stale",
        magic_link_expires_at: past,
        has_resumed: false,
        launch_fail_count: 0,
      },
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 0,
      failed: 1,
      errors: [{ candidateId: "USR_1", error: "IntervueBox agent not found" }],
    });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "IntervueBox agent not found" });
    expect(updateMock).toHaveBeenCalledWith({ launch_fail_count: 1 });
    expect(updateMock).not.toHaveBeenCalledWith({ stuck_at: expect.any(String) });
  });

  it("escalates a first-timer to stuck on the 2nd consecutive vendor failure", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "row-1",
        status: "invited",
        ib_agent_id: "INT_1",
        ib_candidate_id: "USR_1",
        magic_link: "https://stale",
        magic_link_expires_at: past,
        has_resumed: false,
        launch_fail_count: 1,
      },
    });
    reinviteInterviewCandidatesMock.mockRejectedValue(new Error("IntervueBox 500"));
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ leadId: "lead-1" }));
    expect(response.status).toBe(502);
    expect(updateMock).toHaveBeenCalledWith({ launch_fail_count: 2 });
    expect(updateMock).toHaveBeenCalledWith({ stuck_at: expect.any(String) });
  });
});
