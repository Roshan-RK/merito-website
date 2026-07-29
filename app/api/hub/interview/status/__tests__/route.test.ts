import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();
const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
const eqRoleMock = vi.fn().mockReturnValue({ order: orderMock });
const eqUserMock = vi.fn().mockReturnValue({ eq: eqRoleMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock });
const fromMock = vi.fn().mockReturnValue({ select: selectMock });

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

async function importRoute() {
  return await import("../route");
}

function requestFor(role: string) {
  return new Request(`http://localhost/api/hub/interview/status?role=${encodeURIComponent(role)}`);
}

describe("GET /api/hub/interview/status", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    maybeSingleMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when role is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/interview/status"));
    expect(response.status).toBe(400);
  });

  it("returns not_started when there is no row", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: null });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    const body = await response.json();
    expect(body).toEqual({ status: "not_started" });
  });

  it("returns invited while the row is still processing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: { status: "invited" } });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    const body = await response.json();
    expect(body).toEqual({ status: "invited" });
  });

  it("returns ready once the report is generated", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: { status: "ready" } });
    const { GET } = await importRoute();
    const response = await GET(requestFor("Data Analyst"));
    const body = await response.json();
    expect(body).toEqual({ status: "ready" });
  });
});
