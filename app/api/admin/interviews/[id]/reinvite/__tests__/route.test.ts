import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const reinviteInterviewCandidatesMock = vi.fn();
vi.mock("@/lib/intervuebox/invitations", () => ({
  reinviteInterviewCandidates: reinviteInterviewCandidatesMock,
}));

const maybeSingleMock = vi.fn();
const eqSelectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqSelectMock });

const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

const fromMock = vi.fn().mockReturnValue({ select: selectMock, update: updateMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

const logAdminActionMock = vi.fn();
vi.mock("@/lib/adminAuditLog", () => ({ logAdminAction: logAdminActionMock }));

async function importRoute() {
  return await import("../route");
}

function makeRequest() {
  return new Request("http://localhost/api/admin/interviews/row-1/reinvite", { method: "POST" });
}

describe("POST /api/admin/interviews/[id]/reinvite", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    reinviteInterviewCandidatesMock.mockReset();
    maybeSingleMock.mockReset();
    updateMock.mockClear();
    updateEqMock.mockClear();
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("clears stuck_at but does not touch status/magic_link on an already-ready row", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "ready", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
      error: null,
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 1,
      failed: 0,
      magicLinks: [{ candidateId: "USR_1", magicLink: "https://fresh", expiresAt: "2026-08-20T10:00:00.000Z" }],
    });

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "row-1" }) });

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ stuck_at: null });
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "interview.reinvite", targetType: "interview", targetId: "row-1" })
    );
  });

  it("still returns ok when logging the admin action fails", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "ready", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
      error: null,
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 1,
      failed: 0,
      magicLinks: [{ candidateId: "USR_1", magicLink: "https://fresh", expiresAt: "2026-08-20T10:00:00.000Z" }],
    });
    logAdminActionMock.mockRejectedValue(new Error("db down"));

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "row-1" }) });

    expect(response.status).toBe(200);
  });

  it("clears stuck_at and re-links a non-ready row, including has_resumed: false", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "terminated", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
      error: null,
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({
      invited: 1,
      failed: 0,
      magicLinks: [{ candidateId: "USR_1", magicLink: "https://fresh", expiresAt: "2026-08-20T10:00:00.000Z" }],
    });

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "row-1" }) });

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      stuck_at: null,
      status: "invited",
      magic_link: "https://fresh",
      magic_link_expires_at: "2026-08-20T10:00:00.000Z",
      has_resumed: false,
    });
  });

  it("only clears stuck_at when the vendor call returns no magic link", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
      error: null,
    });
    reinviteInterviewCandidatesMock.mockResolvedValue({ invited: 0, failed: 1 });

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "row-1" }) });

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ stuck_at: null });
  });

  it("returns 404 when the row doesn't exist", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { POST } = await importRoute();
    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
    expect(reinviteInterviewCandidatesMock).not.toHaveBeenCalled();
  });

  it("returns 502 when the vendor call throws", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "row-1", status: "invited", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
      error: null,
    });
    reinviteInterviewCandidatesMock.mockRejectedValue(new Error("IntervueBox 500"));
    const { POST } = await importRoute();
    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "row-1" }) });
    expect(response.status).toBe(502);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
