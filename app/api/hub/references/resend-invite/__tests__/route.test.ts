import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const getRefereeForUserMock = vi.fn();
const getCandidateDisplayNameMock = vi.fn();
const createRefereeTokenMock = vi.fn();
const sendRefereeInviteEmailMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/referenceChecks", () => ({
  getRefereeForUser: getRefereeForUserMock,
  getCandidateDisplayName: getCandidateDisplayNameMock,
}));
vi.mock("@/lib/referenceTokens", () => ({
  createRefereeToken: createRefereeTokenMock,
}));
vi.mock("@/lib/referenceEmails", () => ({
  sendRefereeInviteEmail: sendRefereeInviteEmailMock,
}));

async function importRoute() {
  return await import("../route");
}

function body(payload: unknown) {
  return new Request("http://localhost/api/hub/references/resend-invite", { method: "POST", body: JSON.stringify(payload) });
}

describe("POST /api/hub/references/resend-invite", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getRefereeForUserMock.mockReset();
    getCandidateDisplayNameMock.mockReset();
    createRefereeTokenMock.mockReset();
    sendRefereeInviteEmailMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the referee does not belong to this user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue(null);
    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    expect(response.status).toBe(404);
  });

  it("resends the invite for a pending referee", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue({ id: "referee-1", name: "Jane", email: "jane@example.com", status: "pending", reminderCount: 0 });
    getCandidateDisplayNameMock.mockResolvedValue("Alex Kumar");
    createRefereeTokenMock.mockResolvedValue("token-new");
    sendRefereeInviteEmailMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ ok: true });
    expect(sendRefereeInviteEmailMock).toHaveBeenCalledWith({ to: "jane@example.com", refereeName: "Jane", candidateName: "Alex Kumar", token: "token-new" });
  });

  it("returns 409 when the referee already responded", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue({ id: "referee-1", name: "Jane", email: "jane@example.com", status: "completed", reminderCount: 0 });
    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    expect(response.status).toBe(409);
  });
});
