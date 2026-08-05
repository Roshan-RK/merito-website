import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyOtpMock = vi.fn();
const claimFitmentLeadsMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { verifyOtp: verifyOtpMock },
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
    verifyOtpMock.mockReset();
    claimFitmentLeadsMock.mockReset();
  });

  it("claims leads and redirects to /hub/account on a valid token_hash", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "candidate@example.com" } },
      error: null,
    });
    claimFitmentLeadsMock.mockResolvedValue({ claimedCount: 2 });

    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?token_hash=valid-hash&type=magiclink");
    const response = await GET(request);

    expect(verifyOtpMock).toHaveBeenCalledWith({ token_hash: "valid-hash", type: "magiclink" });
    expect(claimFitmentLeadsMock).toHaveBeenCalledWith("user-123", "candidate@example.com");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/hub/account");
  });

  it("redirects to /hub/login?error=expired on an invalid token_hash, without claiming", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });

    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?token_hash=bad-hash&type=magiclink");
    const response = await GET(request);

    expect(claimFitmentLeadsMock).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/hub/login?error=expired");
  });

  it("redirects to /hub/login?error=expired when token_hash is missing", async () => {
    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?type=magiclink");
    const response = await GET(request);

    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/hub/login?error=expired");
  });

  it("redirects to /hub/login?error=expired when type is missing", async () => {
    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?token_hash=valid-hash");
    const response = await GET(request);

    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/hub/login?error=expired");
  });

  it("redirects to /admin when next=/admin is present", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "candidate@example.com" } },
      error: null,
    });
    claimFitmentLeadsMock.mockResolvedValue({ claimedCount: 0 });

    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?token_hash=valid-hash&type=magiclink&next=/admin");
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/admin");
  });

  it("ignores next values outside the allowlist and falls back to /hub/account", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "candidate@example.com" } },
      error: null,
    });
    claimFitmentLeadsMock.mockResolvedValue({ claimedCount: 0 });

    const { GET } = await importRoute();
    const request = new Request(
      "http://localhost/hub/auth/callback?token_hash=valid-hash&type=magiclink&next=" + encodeURIComponent("https://evil.example.com"),
    );
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/hub/account");
    expect(response.headers.get("location")).not.toContain("evil.example.com");
  });

  it("still redirects to /hub/account even if claiming fails", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "candidate@example.com" } },
      error: null,
    });
    claimFitmentLeadsMock.mockRejectedValue(new Error("db down"));

    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?token_hash=valid-hash&type=magiclink");
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/hub/account");
  });
});
