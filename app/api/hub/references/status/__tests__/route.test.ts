import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const getReferenceCheckStatusMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/referenceChecks", () => ({
  getReferenceCheckStatus: getReferenceCheckStatusMock,
}));

async function importRoute() {
  return await import("../route");
}

describe("GET /api/hub/references/status", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getReferenceCheckStatusMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns null when there is no reference check", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getReferenceCheckStatusMock.mockResolvedValue(null);
    const { GET } = await importRoute();
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toBeNull();
  });

  it("returns the check status", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const status = { checkId: "check-1", status: "in_progress", minReferences: 3, referees: [] };
    getReferenceCheckStatusMock.mockResolvedValue(status);
    const { GET } = await importRoute();
    const response = await GET();
    const body = await response.json();
    expect(body).toEqual(status);
  });
});
