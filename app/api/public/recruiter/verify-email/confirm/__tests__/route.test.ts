import { describe, it, expect, vi, beforeEach } from "vitest";

const confirmMock = vi.fn();
vi.mock("@/lib/recruiterIdentity", () => ({
  confirmRecruiterEmail: confirmMock,
}));

async function importRoute() {
  return await import("../route");
}

function request(token: string | null) {
  const url = token ? `http://localhost/api/public/recruiter/verify-email/confirm?token=${token}` : "http://localhost/api/public/recruiter/verify-email/confirm";
  return new Request(url);
}

describe("GET /api/public/recruiter/verify-email/confirm", () => {
  beforeEach(() => confirmMock.mockReset());

  it("returns a 400 HTML page when token is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(request(null));
    expect(response.status).toBe(400);
  });

  it("returns a 400 HTML page when the token is invalid or expired", async () => {
    confirmMock.mockResolvedValue(null);
    const { GET } = await importRoute();
    const response = await GET(request("bad-token"));
    expect(response.status).toBe(400);
  });

  it("returns 200 HTML confirming the email on success", async () => {
    confirmMock.mockResolvedValue({ email: "a@example.com" });
    const { GET } = await importRoute();
    const response = await GET(request("good-token"));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("a@example.com");
  });
});
