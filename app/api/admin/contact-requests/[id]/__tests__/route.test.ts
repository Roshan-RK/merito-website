import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn().mockResolvedValue({ email: "admin@merito.ai" });
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const getContactRequestMock = vi.fn();
const updateContactRequestStatusMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/adminContactRequests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/adminContactRequests")>();
  return {
    ...actual,
    getContactRequest: getContactRequestMock,
    updateContactRequestStatus: updateContactRequestStatusMock,
  };
});

async function importRoute() {
  return await import("../route");
}

function request(body: unknown) {
  return new Request("http://localhost/api/admin/contact-requests/req-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CONTEXT = { params: Promise.resolve({ id: "req-1" }) };

describe("PATCH /api/admin/contact-requests/[id]", () => {
  beforeEach(() => {
    requireAdminMock.mockClear().mockResolvedValue({ email: "admin@merito.ai" });
    getContactRequestMock.mockReset();
    updateContactRequestStatusMock.mockClear().mockResolvedValue(undefined);
  });

  it("returns 400 on an invalid status value", async () => {
    const { PATCH } = await importRoute();
    const response = await PATCH(request({ status: "bogus" }), CONTEXT);
    expect(response.status).toBe(400);
  });

  it("returns 404 when the request does not exist", async () => {
    getContactRequestMock.mockResolvedValue(null);
    const { PATCH } = await importRoute();
    const response = await PATCH(request({ status: "approved" }), CONTEXT);
    expect(response.status).toBe(404);
  });

  it("returns 400 on an invalid transition (approved -> approved is not a listed transition)", async () => {
    getContactRequestMock.mockResolvedValue({ id: "req-1", status: "approved" });
    const { PATCH } = await importRoute();
    const response = await PATCH(request({ status: "approved" }), CONTEXT);
    expect(response.status).toBe(400);
    expect(updateContactRequestStatusMock).not.toHaveBeenCalled();
  });

  it("approves a pending request and records the admin's email", async () => {
    getContactRequestMock.mockResolvedValue({ id: "req-1", status: "pending" });
    const { PATCH } = await importRoute();
    const response = await PATCH(request({ status: "approved" }), CONTEXT);
    expect(response.status).toBe(200);
    expect(updateContactRequestStatusMock).toHaveBeenCalledWith("req-1", "approved", "admin@merito.ai");
  });

  it("allows flipping an approved request to denied", async () => {
    getContactRequestMock.mockResolvedValue({ id: "req-1", status: "approved" });
    const { PATCH } = await importRoute();
    const response = await PATCH(request({ status: "denied" }), CONTEXT);
    expect(response.status).toBe(200);
    expect(updateContactRequestStatusMock).toHaveBeenCalledWith("req-1", "denied", "admin@merito.ai");
  });
});
