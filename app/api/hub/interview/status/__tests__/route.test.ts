import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();
const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
const eqLeadMock = vi.fn().mockReturnValue({ order: orderMock });
const eqUserMock = vi.fn().mockReturnValue({ eq: eqLeadMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock });
const fromMock = vi.fn().mockReturnValue({ select: selectMock });

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

// The READY-only self-heal the route used to hand-roll is now the shared
// reconcileInterviewRow() (its own suite covers the vendor logic); the route's
// job is just mapping its verdict + stuck_at onto a response.
const reconcileInterviewRowMock = vi.fn();
vi.mock("@/lib/intervuebox/reconcileInterviewRow", () => ({
  reconcileInterviewRow: (...a: unknown[]) => reconcileInterviewRowMock(...a),
}));

async function importRoute() {
  return await import("../route");
}

function requestFor(leadId: string) {
  return new Request(`http://localhost/api/hub/interview/status?lead=${encodeURIComponent(leadId)}`);
}

const PENDING_ROW = {
  id: "row-1",
  status: "invited",
  role_title: "PM",
  ib_agent_id: "IV-1",
  ib_candidate_id: "USR-1",
};

describe("GET /api/hub/interview/status", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    maybeSingleMock.mockReset();
    reconcileInterviewRowMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();
    const response = await GET(requestFor("lead-1"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when lead is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/interview/status"));
    expect(response.status).toBe(400);
  });

  it("returns not_started when there is no row", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: null });
    const { GET } = await importRoute();
    const response = await GET(requestFor("lead-1"));
    expect(await response.json()).toEqual({ status: "not_started" });
    expect(reconcileInterviewRowMock).not.toHaveBeenCalled();
  });

  it("returns ready straight from the row without reconciling against IntervueBox", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: { id: "row-1", status: "ready" } });
    const { GET } = await importRoute();
    const response = await GET(requestFor("lead-1"));
    expect(await response.json()).toEqual({ status: "ready" });
    expect(reconcileInterviewRowMock).not.toHaveBeenCalled();
  });

  it("reconciles to ready -- a missed webhook is caught on the poll", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: { ...PENDING_ROW } });
    reconcileInterviewRowMock.mockResolvedValue("ready");
    const { GET } = await importRoute();
    const response = await GET(requestFor("lead-1"));
    expect(await response.json()).toEqual({ status: "ready" });
    expect(reconcileInterviewRowMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "row-1", user_id: "user-1", role_title: "PM" })
    );
  });

  it("reconciles to appeared -- candidate started but has not finished", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: { ...PENDING_ROW } });
    reconcileInterviewRowMock.mockResolvedValue("appeared");
    const { GET } = await importRoute();
    const response = await GET(requestFor("lead-1"));
    expect(await response.json()).toEqual({ status: "appeared" });
  });

  it("reconciles to terminated", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: { ...PENDING_ROW, status: "terminated" } });
    reconcileInterviewRowMock.mockResolvedValue("terminated");
    const { GET } = await importRoute();
    const response = await GET(requestFor("lead-1"));
    expect(await response.json()).toEqual({ status: "terminated" });
  });

  it("still processing -- stays invited", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: { ...PENDING_ROW } });
    reconcileInterviewRowMock.mockResolvedValue("invited");
    const { GET } = await importRoute();
    const response = await GET(requestFor("lead-1"));
    expect(await response.json()).toEqual({ status: "invited" });
  });

  it("returns stuck when stuck_at is set and reconcile leaves it invited", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({
      data: { ...PENDING_ROW, stuck_at: "2026-08-19T10:00:00.000Z" },
    });
    reconcileInterviewRowMock.mockResolvedValue("invited");
    const { GET } = await importRoute();
    const response = await GET(requestFor("lead-1"));
    expect(await response.json()).toEqual({ status: "stuck" });
  });

  it("reconcile to ready still wins over stuck_at", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({
      data: { ...PENDING_ROW, stuck_at: "2026-08-19T10:00:00.000Z" },
    });
    reconcileInterviewRowMock.mockResolvedValue("ready");
    const { GET } = await importRoute();
    const response = await GET(requestFor("lead-1"));
    expect(await response.json()).toEqual({ status: "ready" });
  });
});
