import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const banRecruiterMock = vi.fn();
vi.mock("@/lib/adminRecruiters", () => ({ banRecruiter: banRecruiterMock }));

describe("POST /api/admin/recruiters/[email]/ban", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
    banRecruiterMock.mockReset();
    banRecruiterMock.mockResolvedValue(undefined);
  });

  it("bans the recruiter and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ reason: "abuse" }) }),
      { params: Promise.resolve({ email: "recruiter@company.com" }) }
    );

    expect(response.status).toBe(200);
    expect(banRecruiterMock).toHaveBeenCalledWith("recruiter@company.com", "rushi.humbe@gmail.com", "abuse");
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({}) }), {
      params: Promise.resolve({ email: "recruiter@company.com" }),
    });

    expect(response.status).toBe(400);
  });
});
