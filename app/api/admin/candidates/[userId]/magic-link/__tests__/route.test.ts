import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/adminAuth", () => ({ requireAdmin: requireAdminMock }));

const generateCandidateMagicLinkMock = vi.fn();
vi.mock("@/lib/adminCandidates", () => ({ generateCandidateMagicLink: generateCandidateMagicLinkMock }));

describe("POST /api/admin/candidates/[userId]/magic-link", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ email: "roshan@merito.in" });
    generateCandidateMagicLinkMock.mockReset();
    generateCandidateMagicLinkMock.mockResolvedValue("https://example.com/magic?token=abc");
  });

  it("returns the generated link", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ email: "candidate@example.com" }) }), {
      params: Promise.resolve({ userId: "user-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ link: "https://example.com/magic?token=abc" });
    expect(generateCandidateMagicLinkMock).toHaveBeenCalledWith("candidate@example.com", "roshan@merito.in");
  });

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("../route");

    const response = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({}) }), {
      params: Promise.resolve({ userId: "user-1" }),
    });

    expect(response.status).toBe(400);
  });
});
