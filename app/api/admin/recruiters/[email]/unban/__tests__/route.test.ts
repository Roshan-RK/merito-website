import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const unbanRecruiterMock = vi.fn();
vi.mock("@/lib/adminRecruiters", () => ({ unbanRecruiter: unbanRecruiterMock }));

describe("POST /api/admin/recruiters/[email]/unban", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    unbanRecruiterMock.mockReset();
    unbanRecruiterMock.mockResolvedValue(undefined);
  });

  it("unbans the recruiter and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ email: "recruiter@company.com" }),
    });

    expect(response.status).toBe(200);
    expect(unbanRecruiterMock).toHaveBeenCalledWith("recruiter@company.com", "roshan@merito.in");
  });
});
