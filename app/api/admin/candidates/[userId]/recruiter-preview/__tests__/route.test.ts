import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const updateRecruiterPreviewOverrideMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ updateRecruiterPreviewOverride: updateRecruiterPreviewOverrideMock }));

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/admin/candidates/user-1/recruiter-preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/candidates/[userId]/recruiter-preview", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    updateRecruiterPreviewOverrideMock.mockReset();
    updateRecruiterPreviewOverrideMock.mockResolvedValue(undefined);
  });

  it("updates the settings and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ enabled: true, sections: ["fitment"], reason: "candidate requested" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(200);
    expect(updateRecruiterPreviewOverrideMock).toHaveBeenCalledWith(
      "user-1",
      { enabled: true, sections: ["fitment"] },
      "roshan@merito.in",
      "candidate requested"
    );
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ enabled: true, sections: [] }), { params: Promise.resolve({ userId: "user-1" }) });

    expect(response.status).toBe(400);
    expect(updateRecruiterPreviewOverrideMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid section", async () => {
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ enabled: true, sections: ["bogus"], reason: "x" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 409 when the update fails", async () => {
    updateRecruiterPreviewOverrideMock.mockRejectedValue(new Error("Candidate hasn't set a LinkedIn profile URL yet."));
    const { POST } = await import("../route");

    const response = await POST(buildRequest({ enabled: true, sections: [], reason: "x" }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(409);
  });
});
