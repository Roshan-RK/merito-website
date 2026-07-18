import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const getActiveReferenceCheckIdMock = vi.fn();
const addRefereeMock = vi.fn();
const getCandidateDisplayNameMock = vi.fn();
const createRefereeTokenMock = vi.fn();
const sendRefereeInviteEmailMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/referenceChecks", () => ({
  getActiveReferenceCheckId: getActiveReferenceCheckIdMock,
  addReferee: addRefereeMock,
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
  return new Request("http://localhost/api/hub/references/add-referee", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

describe("POST /api/hub/references/add-referee", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getActiveReferenceCheckIdMock.mockReset();
    addRefereeMock.mockReset();
    getCandidateDisplayNameMock.mockReset();
    createRefereeTokenMock.mockReset();
    sendRefereeInviteEmailMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(body({ name: "Jane", email: "jane@example.com", role: "manager" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await importRoute();
    const response = await POST(body({ name: "", email: "not-an-email", role: "manager" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when there is no active reference check", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getActiveReferenceCheckIdMock.mockResolvedValue(null);
    const { POST } = await importRoute();
    const response = await POST(body({ name: "Jane", email: "jane@example.com", role: "manager" }));
    expect(response.status).toBe(400);
  });

  it("adds the referee, creates a token, and sends the invite email", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getActiveReferenceCheckIdMock.mockResolvedValue("check-1");
    addRefereeMock.mockResolvedValue({ id: "referee-1" });
    getCandidateDisplayNameMock.mockResolvedValue("Alex Kumar");
    createRefereeTokenMock.mockResolvedValue("token-abc");
    sendRefereeInviteEmailMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const response = await POST(body({ name: "Jane", email: "jane@example.com", role: "manager" }));
    const responseBody = await response.json();

    expect(response.status).toBe(201);
    expect(responseBody).toEqual({ refereeId: "referee-1" });
    expect(addRefereeMock).toHaveBeenCalledWith("check-1", expect.objectContaining({ name: "Jane", email: "jane@example.com", role: "manager" }));
    expect(createRefereeTokenMock).toHaveBeenCalledWith("referee-1");
    expect(sendRefereeInviteEmailMock).toHaveBeenCalledWith({
      to: "jane@example.com",
      refereeName: "Jane",
      candidateName: "Alex Kumar",
      token: "token-abc",
    });
  });

  it("returns 409 when the referee cap is reached", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getActiveReferenceCheckIdMock.mockResolvedValue("check-1");
    addRefereeMock.mockRejectedValue(new Error("MAX_REFEREES_REACHED"));
    const { POST } = await importRoute();
    const response = await POST(body({ name: "Jane", email: "jane@example.com", role: "manager" }));
    expect(response.status).toBe(409);
  });
});
