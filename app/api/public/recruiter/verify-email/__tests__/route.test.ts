import { describe, it, expect, vi, beforeEach } from "vitest";

const requestMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/recruiterIdentity", () => ({
  requestRecruiterEmailVerification: requestMock,
}));

async function importRoute() {
  return await import("../route");
}

function request(body: unknown, key = "test-key") {
  return new Request("http://localhost/api/public/recruiter/verify-email", {
    method: "POST",
    headers: key ? { "x-merito-extension-key": key } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/recruiter/verify-email", () => {
  beforeEach(() => {
    vi.stubEnv("RECRUITER_EXTENSION_KEY", "test-key");
    requestMock.mockClear();
  });

  it("returns 401 when the key header is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ email: "a@example.com" }, ""));
    expect(response.status).toBe(401);
  });

  it("returns 404 on an invalid email", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ email: "not-an-email", company: "Acme" }));
    expect(response.status).toBe(404);
  });

  it("returns 404 when company is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ email: "a@example.com" }));
    expect(response.status).toBe(404);
  });

  it("sends the verification email and returns sent:true", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ email: "a@example.com", company: "Acme" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ sent: true });
    expect(requestMock).toHaveBeenCalledWith("a@example.com", "Acme");
  });

  it("returns 429 after exceeding the per-email rate limit", async () => {
    const { POST } = await importRoute();
    let lastStatus = 200;
    for (let i = 0; i < 4; i++) {
      const response = await POST(request({ email: "rate-limited@example.com", company: "Acme" }));
      lastStatus = response.status;
    }
    expect(lastStatus).toBe(429);
  });
});
