import { describe, it, expect, vi, beforeEach } from "vitest";

const exchangeCodeForSessionMock = vi.fn();
const claimFitmentLeadsMock = vi.fn();

vi.mock("@/lib/supabaseAuth", () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
  }),
}));
vi.mock("@/lib/claimFitmentLeads", () => ({
  claimFitmentLeads: claimFitmentLeadsMock,
}));

async function importRoute() {
  return await import("../route");
}

describe("GET /hub/auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSessionMock.mockReset();
    claimFitmentLeadsMock.mockReset();
  });

  it("claims leads and redirects to /hub/account on a valid code", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "candidate@example.com" } },
      error: null,
    });
    claimFitmentLeadsMock.mockResolvedValue({ claimedCount: 2 });

    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?code=valid-code");
    const response = await GET(request);

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("valid-code");
    expect(claimFitmentLeadsMock).toHaveBeenCalledWith("user-123", "candidate@example.com");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/hub/account");
  });

  it("redirects to /hub/login?error=expired on an invalid code, without claiming", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid code" },
    });

    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?code=bad-code");
    const response = await GET(request);

    expect(claimFitmentLeadsMock).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/hub/login?error=expired");
  });

  it("redirects to /hub/login?error=expired when no code is present", async () => {
    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback");
    const response = await GET(request);

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/hub/login?error=expired");
  });

  it("still redirects to /hub/account even if claiming fails", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "candidate@example.com" } },
      error: null,
    });
    claimFitmentLeadsMock.mockRejectedValue(new Error("db down"));

    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?code=valid-code");
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/hub/account");
  });
});
