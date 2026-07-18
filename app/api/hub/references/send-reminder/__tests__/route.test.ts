import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const getRefereeForUserMock = vi.fn();
const getCandidateDisplayNameMock = vi.fn();
const createRefereeTokenMock = vi.fn();
const sendRefereeReminderEmailMock = vi.fn();
const incrementReminderCountMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/referenceChecks", () => ({
  getRefereeForUser: getRefereeForUserMock,
  getCandidateDisplayName: getCandidateDisplayNameMock,
  incrementReminderCount: incrementReminderCountMock,
  MAX_REMINDERS: 3,
}));
vi.mock("@/lib/referenceTokens", () => ({
  createRefereeToken: createRefereeTokenMock,
}));
vi.mock("@/lib/referenceEmails", () => ({
  sendRefereeReminderEmail: sendRefereeReminderEmailMock,
}));

async function importRoute() {
  return await import("../route");
}

function body(payload: unknown) {
  return new Request("http://localhost/api/hub/references/send-reminder", { method: "POST", body: JSON.stringify(payload) });
}

describe("POST /api/hub/references/send-reminder", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getRefereeForUserMock.mockReset();
    getCandidateDisplayNameMock.mockReset();
    createRefereeTokenMock.mockReset();
    sendRefereeReminderEmailMock.mockReset();
    incrementReminderCountMock.mockReset();
  });

  it("returns 409 when the reminder cap is already reached", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue({ id: "referee-1", name: "Jane", email: "jane@example.com", status: "pending", reminderCount: 3, checkStatus: "in_progress" });
    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    expect(response.status).toBe(409);
    expect(incrementReminderCountMock).not.toHaveBeenCalled();
  });

  it("sends a reminder and increments the count", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue({ id: "referee-1", name: "Jane", email: "jane@example.com", status: "pending", reminderCount: 1, checkStatus: "in_progress" });
    getCandidateDisplayNameMock.mockResolvedValue("Alex Kumar");
    createRefereeTokenMock.mockResolvedValue("token-new");
    sendRefereeReminderEmailMock.mockResolvedValue(undefined);
    incrementReminderCountMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ ok: true });
    expect(incrementReminderCountMock).toHaveBeenCalledWith("referee-1");
  });

  it("returns 409 when the reference check is no longer active", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue({ id: "referee-1", name: "Jane", email: "jane@example.com", status: "pending", reminderCount: 1, checkStatus: "cancelled" });
    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    expect(response.status).toBe(409);
    expect(incrementReminderCountMock).not.toHaveBeenCalled();
    expect(sendRefereeReminderEmailMock).not.toHaveBeenCalled();
  });
});
