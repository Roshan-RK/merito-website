import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const banCandidateMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ banCandidate: banCandidateMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/candidates/user-1/ban", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/candidates/[userId]/ban", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
    banCandidateMock.mockReset();
    banCandidateMock.mockResolvedValue(undefined);
  });

  it("bans the candidate and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ reason: "spam" }), { params: Promise.resolve({ userId: "user-1" }) });

    expect(response.status).toBe(200);
    expect(banCandidateMock).toHaveBeenCalledWith("user-1", "rushi.humbe@gmail.com", "spam");
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({}), { params: Promise.resolve({ userId: "user-1" }) });

    expect(response.status).toBe(400);
    expect(banCandidateMock).not.toHaveBeenCalled();
  });
});
