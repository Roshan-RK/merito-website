import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const updateRefereeContactMock = vi.fn();
vi.mock("@/lib/referenceChecks", () => ({ updateRefereeContact: updateRefereeContactMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/referees/referee-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/referees/[id]", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    updateRefereeContactMock.mockReset();
    updateRefereeContactMock.mockResolvedValue(undefined);
  });

  it("updates the referee and returns ok", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      buildRequest({ name: "Jane", email: "jane@example.com", phone: "123", organization: "Acme", reason: "typo fix" }),
      { params: Promise.resolve({ id: "referee-1" }) }
    );

    expect(response.status).toBe(200);
    expect(updateRefereeContactMock).toHaveBeenCalledWith(
      "referee-1",
      { name: "Jane", email: "jane@example.com", phone: "123", organization: "Acme" },
      "roshan@merito.in",
      "typo fix"
    );
  });

  it("returns 400 when reason is missing", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(buildRequest({ name: "Jane", email: "jane@example.com", phone: null, organization: null }), {
      params: Promise.resolve({ id: "referee-1" }),
    });

    expect(response.status).toBe(400);
    expect(updateRefereeContactMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(buildRequest({ name: "Jane", email: "not-an-email", phone: null, organization: null, reason: "x" }), {
      params: Promise.resolve({ id: "referee-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 409 when the referee doesn't exist", async () => {
    updateRefereeContactMock.mockRejectedValue(new Error("Referee not found."));
    const { PATCH } = await import("../route");

    const response = await PATCH(
      buildRequest({ name: "Jane", email: "jane@example.com", phone: null, organization: null, reason: "x" }),
      { params: Promise.resolve({ id: "referee-1" }) }
    );

    expect(response.status).toBe(409);
  });
});
