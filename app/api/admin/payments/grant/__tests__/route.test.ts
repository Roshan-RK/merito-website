import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const grantFreeAccessMock = vi.fn();
vi.mock("@/lib/adminPayments", () => ({ grantFreeAccess: grantFreeAccessMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/payments/grant", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/admin/payments/grant", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "admin@merito.in" });
    grantFreeAccessMock.mockReset();
    grantFreeAccessMock.mockResolvedValue(undefined);
  });

  it("grants and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ email: "candidate@example.com", product: "personality", level: "entry", reason: "goodwill" }));

    expect(response.status).toBe(200);
    expect(grantFreeAccessMock).toHaveBeenCalledWith(
      { email: "candidate@example.com", product: "personality", level: "entry", reason: "goodwill" },
      "admin@merito.in"
    );
  });

  it("returns 400 for an invalid product", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ email: "candidate@example.com", product: "nonsense", level: "entry", reason: "goodwill" }));

    expect(response.status).toBe(400);
    expect(grantFreeAccessMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the grant fails", async () => {
    grantFreeAccessMock.mockRejectedValue(new Error("Candidate already has personality unlocked."));
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ email: "candidate@example.com", product: "personality", level: "entry", reason: "goodwill" }));

    expect(response.status).toBe(409);
  });
});
