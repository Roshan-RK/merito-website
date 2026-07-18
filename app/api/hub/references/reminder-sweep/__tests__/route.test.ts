import { describe, it, expect, vi, beforeEach } from "vitest";

const getStaleRefereesForReminderMock = vi.fn();
const getReferenceCheckOwnerMock = vi.fn();
const getCandidateDisplayNameMock = vi.fn();
const incrementReminderCountMock = vi.fn();
const createRefereeTokenMock = vi.fn();
const sendRefereeReminderEmailMock = vi.fn();

vi.mock("@/lib/referenceChecks", () => ({
  getStaleRefereesForReminder: getStaleRefereesForReminderMock,
  getReferenceCheckOwner: getReferenceCheckOwnerMock,
  getCandidateDisplayName: getCandidateDisplayNameMock,
  incrementReminderCount: incrementReminderCountMock,
}));
vi.mock("@/lib/referenceTokens", () => ({
  createRefereeToken: createRefereeTokenMock,
}));
vi.mock("@/lib/referenceEmails", () => ({
  sendRefereeReminderEmail: sendRefereeReminderEmailMock,
}));

const ORIGINAL_ENV = { ...process.env };

async function importRoute() {
  return await import("../route");
}

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/hub/references/reminder-sweep", { method: "GET", headers });
}

describe("GET /api/hub/references/reminder-sweep", () => {
  beforeEach(() => {
    getStaleRefereesForReminderMock.mockReset();
    getReferenceCheckOwnerMock.mockReset();
    getCandidateDisplayNameMock.mockReset();
    incrementReminderCountMock.mockReset();
    createRefereeTokenMock.mockReset();
    sendRefereeReminderEmailMock.mockReset();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "sekret" };
  });

  it("returns 401 when the bearer token doesn't match CRON_SECRET", async () => {
    const { GET } = await importRoute();
    const response = await GET(request({ authorization: "Bearer wrong" }));
    expect(response.status).toBe(401);
    expect(getStaleRefereesForReminderMock).not.toHaveBeenCalled();
  });

  it("sends a reminder to each stale referee and reports the count", async () => {
    getStaleRefereesForReminderMock.mockResolvedValue([
      { id: "referee-1", name: "Jane", email: "jane@example.com", reference_check_id: "check-1" },
      { id: "referee-2", name: "Sam", email: "sam@example.com", reference_check_id: "check-2" },
    ]);
    getReferenceCheckOwnerMock.mockImplementation(async (checkId: string) => (checkId === "check-1" ? "user-1" : "user-2"));
    getCandidateDisplayNameMock.mockResolvedValue("Alex Kumar");
    createRefereeTokenMock.mockResolvedValue("token-x");
    sendRefereeReminderEmailMock.mockResolvedValue(undefined);
    incrementReminderCountMock.mockResolvedValue(undefined);

    const { GET } = await importRoute();
    const response = await GET(request({ authorization: "Bearer sekret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ remindersSent: 2 });
    expect(sendRefereeReminderEmailMock).toHaveBeenCalledTimes(2);
    expect(incrementReminderCountMock).toHaveBeenCalledWith("referee-1");
    expect(incrementReminderCountMock).toHaveBeenCalledWith("referee-2");
  });

  it("skips a referee whose check owner can't be resolved, without failing the sweep", async () => {
    getStaleRefereesForReminderMock.mockResolvedValue([{ id: "referee-1", name: "Jane", email: "jane@example.com", reference_check_id: "check-1" }]);
    getReferenceCheckOwnerMock.mockResolvedValue(null);

    const { GET } = await importRoute();
    const response = await GET(request({ authorization: "Bearer sekret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ remindersSent: 0 });
    expect(sendRefereeReminderEmailMock).not.toHaveBeenCalled();
  });

  it("isolates a per-referee failure so the rest of the sweep still succeeds", async () => {
    getStaleRefereesForReminderMock.mockResolvedValue([
      { id: "referee-1", name: "Jane", email: "jane@example.com", reference_check_id: "check-1" },
      { id: "referee-2", name: "Sam", email: "sam@example.com", reference_check_id: "check-2" },
    ]);
    getReferenceCheckOwnerMock.mockImplementation(async (checkId: string) => (checkId === "check-1" ? "user-1" : "user-2"));
    getCandidateDisplayNameMock.mockResolvedValue("Alex Kumar");
    createRefereeTokenMock.mockResolvedValue("token-x");
    sendRefereeReminderEmailMock.mockImplementation(async ({ to }: { to: string }) => {
      if (to === "jane@example.com") throw new Error("send failed");
    });
    incrementReminderCountMock.mockResolvedValue(undefined);

    const { GET } = await importRoute();
    const response = await GET(request({ authorization: "Bearer sekret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ remindersSent: 1 });
    expect(incrementReminderCountMock).not.toHaveBeenCalledWith("referee-1");
    expect(incrementReminderCountMock).toHaveBeenCalledWith("referee-2");
    expect(incrementReminderCountMock).toHaveBeenCalledTimes(1);
  });
});
