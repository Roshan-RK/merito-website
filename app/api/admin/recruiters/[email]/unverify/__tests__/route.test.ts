import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const unverifyRecruiterMock = vi.fn();
vi.mock("@/lib/adminRecruiters", () => ({ unverifyRecruiter: unverifyRecruiterMock }));

describe("POST /api/admin/recruiters/[email]/unverify", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "rushi.humbe@gmail.com" });
    unverifyRecruiterMock.mockReset();
    unverifyRecruiterMock.mockResolvedValue(undefined);
  });

  it("unverifies the recruiter and returns ok", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ email: "recruiter@company.com" }),
    });

    expect(response.status).toBe(200);
    expect(unverifyRecruiterMock).toHaveBeenCalledWith("recruiter@company.com", "rushi.humbe@gmail.com");
  });
});
