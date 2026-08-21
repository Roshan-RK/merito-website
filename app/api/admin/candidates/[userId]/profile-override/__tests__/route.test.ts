import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const overrideCandidateProfileMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ overrideCandidateProfile: overrideCandidateProfileMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/candidates/user-1/profile-override", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
  overrideCandidateProfileMock.mockReset();
  overrideCandidateProfileMock.mockResolvedValue(undefined);
});

describe("POST /api/admin/candidates/[userId]/profile-override", () => {
  it("overrides the profile and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      buildRequest({ phoneNumber: "222", location: "New City", totalExperience: 3.5, reason: "resume parser got the city wrong" }),
      { params: Promise.resolve({ userId: "user-1" }) }
    );

    expect(response.status).toBe(200);
    expect(overrideCandidateProfileMock).toHaveBeenCalledWith(
      "user-1",
      { phoneNumber: "222", location: "New City", totalExperience: 3.5 },
      "roshan@merito.in",
      "resume parser got the city wrong"
    );
  });

  it("accepts null fields", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ phoneNumber: null, location: null, totalExperience: null, reason: "cleared" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(200);
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ phoneNumber: "222", location: "x", totalExperience: 1 }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(400);
    expect(overrideCandidateProfileMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the override fails", async () => {
    overrideCandidateProfileMock.mockRejectedValue(new Error("totalExperience must be a non-negative number or null."));
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ phoneNumber: null, location: null, totalExperience: -1, reason: "x" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(409);
  });
});
