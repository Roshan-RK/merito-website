import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const createOrUpdateShareLinkMock = vi.fn();
const getShareLinkMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/reportShareTokens", () => ({
  createOrUpdateShareLink: createOrUpdateShareLinkMock,
  getShareLink: getShareLinkMock,
}));

function buildRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe("GET /api/hub/share", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getShareLinkMock.mockReset();
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("../route");

    const response = await GET(buildRequest("http://localhost/api/hub/share?role=Senior%20Product%20Manager"));
    expect(response.status).toBe(401);
  });

  it("returns url:null when no link exists yet", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getShareLinkMock.mockResolvedValue(null);
    const { GET } = await import("../route");

    const response = await GET(buildRequest("http://localhost/api/hub/share?role=Senior%20Product%20Manager"));
    const body = await response.json();
    expect(body).toEqual({ url: null });
  });

  it("returns the link's url and revoked state when one exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getShareLinkMock.mockResolvedValue({ token: "abc123", revoked: false });
    const { GET } = await import("../route");

    const response = await GET(buildRequest("http://localhost/api/hub/share?role=Senior%20Product%20Manager"));
    const body = await response.json();
    expect(body.url).toContain("/hub/share/abc123");
    expect(body.revoked).toBe(false);
  });
});

describe("POST /api/hub/share", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    createOrUpdateShareLinkMock.mockReset();
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("../route");

    const response = await POST(
      buildRequest("http://localhost/api/hub/share", {
        method: "POST",
        body: JSON.stringify({ roleTitle: "Senior Product Manager", include: "fitment", interviewSections: "" }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("creates/updates the link and returns its url", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    createOrUpdateShareLinkMock.mockResolvedValue({ token: "abc123" });
    const { POST } = await import("../route");

    const response = await POST(
      buildRequest("http://localhost/api/hub/share", {
        method: "POST",
        body: JSON.stringify({ roleTitle: "Senior Product Manager", include: "fitment,interview", interviewSections: "scoreGauge" }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.url).toContain("/hub/share/abc123");
    expect(createOrUpdateShareLinkMock).toHaveBeenCalledWith({
      userId: "user-1",
      roleTitle: "Senior Product Manager",
      include: "fitment,interview",
      interviewSections: "scoreGauge",
    });
  });

  it("returns 400 for an invalid body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await import("../route");

    const response = await POST(buildRequest("http://localhost/api/hub/share", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });
});
