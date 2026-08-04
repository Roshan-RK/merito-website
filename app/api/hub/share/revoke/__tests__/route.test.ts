import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const setShareLinkRevokedMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/reportShareTokens", () => ({
  setShareLinkRevoked: setShareLinkRevokedMock,
}));

function buildRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe("POST /api/hub/share/revoke", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    setShareLinkRevokedMock.mockReset();
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("../route");

    const response = await POST(
      buildRequest("http://localhost/api/hub/share/revoke", {
        method: "POST",
        body: JSON.stringify({ roleTitle: "Senior Product Manager", revoked: true }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("toggles the link's revoked state for the signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    setShareLinkRevokedMock.mockResolvedValue(undefined);
    const { POST } = await import("../route");

    const response = await POST(
      buildRequest("http://localhost/api/hub/share/revoke", {
        method: "POST",
        body: JSON.stringify({ roleTitle: "Senior Product Manager", revoked: true }),
      })
    );

    expect(response.status).toBe(200);
    expect(setShareLinkRevokedMock).toHaveBeenCalledWith({ userId: "user-1", roleTitle: "Senior Product Manager", revoked: true });
  });

  it("returns 400 for an invalid body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await import("../route");

    const response = await POST(buildRequest("http://localhost/api/hub/share/revoke", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });
});
