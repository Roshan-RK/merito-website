import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const setShareLinkRevokedByTokenMock = vi.fn();
vi.mock("@/lib/reportShareTokens", () => ({ setShareLinkRevokedByToken: setShareLinkRevokedByTokenMock }));

const logAdminActionMock = vi.fn();
vi.mock("@/lib/adminAuditLog", () => ({ logAdminAction: logAdminActionMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/share-links/token-1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/admin/share-links/[token]", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "admin@merito.in" });
    setShareLinkRevokedByTokenMock.mockReset();
    setShareLinkRevokedByTokenMock.mockResolvedValue(undefined);
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("revokes the link and logs the admin action", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(buildRequest({ revoked: true }), { params: Promise.resolve({ token: "token-1" }) });

    expect(response.status).toBe(200);
    expect(setShareLinkRevokedByTokenMock).toHaveBeenCalledWith("token-1", true);
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "share_link.set_revoked", targetType: "share_link", targetId: "token-1", newValue: { revoked: true } })
    );
  });

  it("returns 400 when revoked is not a boolean", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(buildRequest({ revoked: "yes" }), { params: Promise.resolve({ token: "token-1" }) });

    expect(response.status).toBe(400);
    expect(setShareLinkRevokedByTokenMock).not.toHaveBeenCalled();
  });

  it("still returns ok when logging the admin action fails", async () => {
    logAdminActionMock.mockRejectedValue(new Error("db down"));
    const { PATCH } = await import("../route");

    const response = await PATCH(buildRequest({ revoked: false }), { params: Promise.resolve({ token: "token-1" }) });

    expect(response.status).toBe(200);
  });
});
