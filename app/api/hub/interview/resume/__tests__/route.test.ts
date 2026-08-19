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
  return new Request("http://localhost/api/hub/interview/resume", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/hub/interview/resume", () => {
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

  it("returns 400 when there's no terminated row for the role", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));
    expect(response.status).toBe(400);
  });

  it("on success, updates the row and returns the fresh magic link", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "terminated", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
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
    expect(reinviteInterviewCandidatesMock).toHaveBeenCalledWith("INT_1", ["USR_1"], "RESUME");
    expect(updateMock).toHaveBeenCalledWith({
      status: "invited",
      magic_link: "https://fresh",
      magic_link_expires_at: "2026-08-20T10:00:00.000Z",
      ib_interview_status: null,
      has_resumed: true,
    });
  });

  it("on vendor failure, surfaces the vendor's real error message and leaves the row unchanged", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "terminated", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 0,
      failed: 1,
      errors: [{ candidateId: "USR_1", error: "Cannot resume an interview in status EVALUATED. Use mode=REINVITE to start a new attempt." }],
    });

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Cannot resume an interview in status EVALUATED. Use mode=REINVITE to start a new attempt.",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns a 502 JSON error (not a crash) when the vendor reinvite call throws, and doesn't update the row", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "terminated", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
    });
    reinviteInterviewCandidatesMock.mockRejectedValue(new Error("IntervueBox 500"));

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "IntervueBox rejected the reinvite request." });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sets stuck_at when a resumed row's reinvite call throws", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "terminated", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", has_resumed: true },
    });
    reinviteInterviewCandidatesMock.mockRejectedValue(new Error("IntervueBox 500"));

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));

    expect(response.status).toBe(502);
    expect(updateMock).toHaveBeenCalledWith({ stuck_at: expect.any(String) });
  });

  it("sets stuck_at when a row that's already been resumed once fails again", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "terminated", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", has_resumed: true },
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 0,
      failed: 1,
      errors: [{ candidateId: "USR_1", error: "Cannot resume an interview in status EVALUATED" }],
    });

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));

    expect(response.status).toBe(502);
    expect(updateMock).toHaveBeenCalledWith({ stuck_at: expect.any(String) });
  });

  it("does not set stuck_at when a row on its first resume attempt fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "terminated", ib_agent_id: "INT_1", ib_candidate_id: "USR_1", has_resumed: false },
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 0,
      failed: 1,
      errors: [{ candidateId: "USR_1", error: "Some vendor error" }],
    });

    const { POST } = await importRoute();
    const response = await POST(makeRequest({ roleTitle: "Backend Engineer" }));

    expect(response.status).toBe(502);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
