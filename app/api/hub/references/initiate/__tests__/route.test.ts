import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const initiateReferenceCheckMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/referenceChecks", () => ({
  initiateReferenceCheck: initiateReferenceCheckMock,
}));

async function importRoute() {
  return await import("../route");
}

describe("POST /api/hub/references/initiate", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    initiateReferenceCheckMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(new Request("http://localhost/api/hub/references/initiate", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("returns 201 with the new check id", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    initiateReferenceCheckMock.mockResolvedValue({ id: "check-1" });
    const { POST } = await importRoute();
    const response = await POST(new Request("http://localhost/api/hub/references/initiate", { method: "POST" }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({ checkId: "check-1" });
  });

  it("returns 409 when a check is already active", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    initiateReferenceCheckMock.mockRejectedValue(new Error("ALREADY_ACTIVE"));
    const { POST } = await importRoute();
    const response = await POST(new Request("http://localhost/api/hub/references/initiate", { method: "POST" }));
    expect(response.status).toBe(409);
  });
});
