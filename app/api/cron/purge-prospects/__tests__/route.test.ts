import { describe, it, expect, vi, beforeEach } from "vitest";

const purgeMock = vi.fn();
vi.mock("@/lib/purgeProspects", () => ({ purgeStaleProspects: purgeMock }));

async function importRoute() {
  return await import("../route");
}

function request(auth?: string) {
  return new Request("http://localhost/api/cron/purge-prospects", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("GET /api/cron/purge-prospects", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "secret-123");
    purgeMock.mockReset();
  });

  it("returns 401 without the correct bearer secret", async () => {
    const { GET } = await importRoute();
    const response = await GET(request("Bearer wrong"));
    expect(response.status).toBe(401);
  });

  it("returns the purged count on success", async () => {
    purgeMock.mockResolvedValue({ purgedCount: 3 });
    const { GET } = await importRoute();
    const response = await GET(request("Bearer secret-123"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ purgedCount: 3 });
  });
});
