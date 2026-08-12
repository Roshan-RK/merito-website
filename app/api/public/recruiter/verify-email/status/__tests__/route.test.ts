import { describe, it, expect, vi, beforeEach } from "vitest";

const isVerifiedMock = vi.fn();
vi.mock("@/lib/recruiterIdentity", () => ({
  isRecruiterEmailVerified: isVerifiedMock,
}));

async function importRoute() {
  return await import("../route");
}

function request(email: string | null, key = "test-key") {
  const url = new URL("http://localhost/api/public/recruiter/verify-email/status");
  if (email !== null) url.searchParams.set("email", email);
  return new Request(url, { headers: key ? { "x-merito-extension-key": key } : {} });
}

describe("GET /api/public/recruiter/verify-email/status", () => {
  beforeEach(() => {
    vi.stubEnv("RECRUITER_EXTENSION_KEY", "test-key");
    isVerifiedMock.mockReset();
  });

  it("returns 401 when the key header is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(request("a@example.com", ""));
    expect(response.status).toBe(401);
  });

  it("returns 404 when email is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(request(null));
    expect(response.status).toBe(404);
  });

  it("returns verified:true when the email is verified", async () => {
    isVerifiedMock.mockResolvedValue(true);
    const { GET } = await importRoute();
    const response = await GET(request("a@example.com"));
    expect(await response.json()).toEqual({ verified: true });
    expect(isVerifiedMock).toHaveBeenCalledWith("a@example.com");
  });

  it("returns verified:false when the email is not verified", async () => {
    isVerifiedMock.mockResolvedValue(false);
    const { GET } = await importRoute();
    const response = await GET(request("a@example.com"));
    expect(await response.json()).toEqual({ verified: false });
  });
});
