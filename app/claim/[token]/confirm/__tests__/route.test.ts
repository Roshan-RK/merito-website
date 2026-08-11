import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyOtpMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { verifyOtp: verifyOtpMock } }),
}));

const convertMock = vi.fn();
vi.mock("@/lib/prospectConversion", () => ({ convertProspectToLead: convertMock }));

async function importRoute() {
  return await import("../route");
}

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) };
}

function request(query: string) {
  return new Request(`http://localhost/claim/tok123/confirm${query}`);
}

describe("GET /claim/[token]/confirm", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    convertMock.mockReset();
  });

  it("redirects to the claim page with an error when token_hash is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(request(""), makeParams("tok123"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/claim/tok123?error=expired");
  });

  it("redirects with an error when OTP verification fails", async () => {
    verifyOtpMock.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    const { GET } = await importRoute();
    const response = await GET(request("?token_hash=abc&type=email"), makeParams("tok123"));
    expect(response.headers.get("location")).toContain("/claim/tok123?error=expired");
  });

  it("converts the prospect and redirects to /hub/account on success", async () => {
    verifyOtpMock.mockResolvedValue({ data: { user: { id: "user-1", email: "jane@example.com" } }, error: null });
    convertMock.mockResolvedValue({ status: "converted", leadId: "lead-1" });
    const { GET } = await importRoute();
    const response = await GET(request("?token_hash=abc&type=email"), makeParams("tok123"));
    expect(convertMock).toHaveBeenCalledWith("tok123", "user-1", "jane@example.com");
    expect(response.headers.get("location")).toContain("/hub/account");
  });
});
