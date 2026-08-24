import { describe, it, expect, vi, beforeEach } from "vitest";

const shortlistMock = vi.fn();
vi.mock("@/lib/prospectShortlist", () => ({ shortlistProspect: shortlistMock }));

const isRecruiterEmailVerifiedMock = vi.fn();
vi.mock("@/lib/recruiterIdentity", () => ({
  isRecruiterEmailVerified: isRecruiterEmailVerifiedMock,
}));

async function importRoute() {
  return await import("../route");
}

function request(body: Record<string, unknown>, key = "test-key") {
  return new Request("http://localhost/api/public/recruiter-preview/shortlist", {
    method: "POST",
    headers: key ? { "x-merito-extension-key": key } : {},
    body: JSON.stringify({ recruiterEmail: "recruiter@example.com", ...body }),
  });
}

describe("POST /api/public/recruiter-preview/shortlist", () => {
  beforeEach(() => {
    vi.stubEnv("RECRUITER_EXTENSION_KEY", "test-key");
    shortlistMock.mockReset();
    isRecruiterEmailVerifiedMock.mockReset();
    isRecruiterEmailVerifiedMock.mockResolvedValue(true);
  });

  it("returns 401 when the key header is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ prospectId: "p1" }, ""));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the prospect doesn't exist", async () => {
    shortlistMock.mockResolvedValue(null);
    const { POST } = await importRoute();
    const response = await POST(request({ prospectId: "missing" }));
    expect(response.status).toBe(404);
  });

  it("returns 200 with claimUrl and inviteText on success", async () => {
    shortlistMock.mockResolvedValue({ claimUrl: "https://www.merito.in/claim/abc", inviteText: "Hi Jane..." });
    const { POST } = await importRoute();
    const response = await POST(request({ prospectId: "p1" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.claimUrl).toBe("https://www.merito.in/claim/abc");
  });

  it("returns 403 when recruiterEmail is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ prospectId: "p1", recruiterEmail: undefined }));
    expect(response.status).toBe(403);
    expect(shortlistMock).not.toHaveBeenCalled();
  });

  it("returns 403 when recruiterEmail is not verified", async () => {
    isRecruiterEmailVerifiedMock.mockResolvedValue(false);
    const { POST } = await importRoute();
    const response = await POST(request({ prospectId: "p1" }));
    expect(response.status).toBe(403);
    expect(shortlistMock).not.toHaveBeenCalled();
  });
});
