import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

const getReferenceCheckStatusMock = vi.fn();
vi.mock("@/lib/referenceChecks", () => ({ getReferenceCheckStatus: getReferenceCheckStatusMock }));

const renderPageToPdfMock = vi.fn();
vi.mock("@/lib/pdf/renderPageToPdf", () => ({
  renderPageToPdf: renderPageToPdfMock,
  requestCookiesFor: () => [],
}));

async function importRoute() {
  return await import("../route");
}

describe("GET /api/hub/references/export", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getReferenceCheckStatusMock.mockReset();
    renderPageToPdfMock.mockReset();
    renderPageToPdfMock.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();

    const response = await GET(new Request("http://localhost/api/hub/references/export"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when the reference check isn't completed", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    getReferenceCheckStatusMock.mockResolvedValue({
      checkId: "chk-1",
      status: "in_progress",
      minReferences: 3,
      referees: [],
    });
    const { GET } = await importRoute();

    const response = await GET(new Request("http://localhost/api/hub/references/export"));

    expect(response.status).toBe(404);
    expect(renderPageToPdfMock).not.toHaveBeenCalled();
  });

  it("returns a PDF rendered from the live references page when completed", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "roshan@merito.in" } } });
    getReferenceCheckStatusMock.mockResolvedValue({
      checkId: "chk-1",
      status: "completed",
      minReferences: 3,
      referees: [],
    });
    const { GET } = await importRoute();

    const response = await GET(new Request("http://localhost/api/hub/references/export"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(renderPageToPdfMock).toHaveBeenCalledWith("http://localhost/hub/account/references/print", [], { singlePage: true });
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
