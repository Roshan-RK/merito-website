import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const mergeCandidateAccountsMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ mergeCandidateAccounts: mergeCandidateAccountsMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/candidates/merge", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/admin/candidates/merge", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
    mergeCandidateAccountsMock.mockReset();
    mergeCandidateAccountsMock.mockResolvedValue(undefined);
  });

  it("merges the accounts and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ keepUserId: "user-keep", mergeUserId: "user-merge" }));

    expect(response.status).toBe(200);
    expect(mergeCandidateAccountsMock).toHaveBeenCalledWith("user-keep", "user-merge", "rushi.humbe@gmail.com");
  });

  it("returns 400 when keepUserId equals mergeUserId", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ keepUserId: "user-1", mergeUserId: "user-1" }));

    expect(response.status).toBe(400);
    expect(mergeCandidateAccountsMock).not.toHaveBeenCalled();
  });

  it("returns 400 when a field is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ keepUserId: "user-keep" }));

    expect(response.status).toBe(400);
  });
});
