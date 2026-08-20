import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sweepPendingInterviewsMock = vi.fn();
vi.mock("@/lib/intervuebox/sweepPendingInterviews", () => ({
  sweepPendingInterviews: sweepPendingInterviewsMock,
}));

async function importRoute() {
  return await import("../route");
}

describe("GET /api/cron/interview-sweep", () => {
  beforeEach(() => {
    sweepPendingInterviewsMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 without a matching CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "expected-secret");
    const { GET } = await importRoute();
    const request = new Request("http://localhost/api/cron/interview-sweep");
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(sweepPendingInterviewsMock).not.toHaveBeenCalled();
  });

  it("runs the sweep and returns its counts when the secret matches", async () => {
    vi.stubEnv("CRON_SECRET", "expected-secret");
    sweepPendingInterviewsMock.mockResolvedValue({ ready: 2, appeared: 1, terminated: 1, errors: 0 });
    const { GET } = await importRoute();
    const request = new Request("http://localhost/api/cron/interview-sweep", {
      headers: { authorization: "Bearer expected-secret" },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: 2, appeared: 1, terminated: 1, errors: 0 });
  });
});
