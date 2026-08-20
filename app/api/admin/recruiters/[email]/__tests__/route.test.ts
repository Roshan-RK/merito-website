import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const updateRecruiterCompanyMock = vi.fn();
vi.mock("@/lib/adminRecruiters", () => ({ updateRecruiterCompany: updateRecruiterCompanyMock }));

describe("PATCH /api/admin/recruiters/[email]", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    updateRecruiterCompanyMock.mockReset();
    updateRecruiterCompanyMock.mockResolvedValue(undefined);
  });

  it("updates the company name and returns ok", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ companyName: "New Co" }) }),
      { params: Promise.resolve({ email: "recruiter@company.com" }) }
    );

    expect(response.status).toBe(200);
    expect(updateRecruiterCompanyMock).toHaveBeenCalledWith("recruiter@company.com", "New Co", "roshan@merito.in");
  });

  it("returns 400 when companyName is missing", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({}) }), {
      params: Promise.resolve({ email: "recruiter@company.com" }),
    });

    expect(response.status).toBe(400);
  });
});
