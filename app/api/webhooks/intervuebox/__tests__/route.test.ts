import crypto from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sweepPendingInterviewsMock = vi.fn().mockResolvedValue({ ready: 0, appeared: 0, terminated: 0, errors: 0 });
vi.mock("@/lib/intervuebox/sweepPendingInterviews", () => ({
  sweepPendingInterviews: sweepPendingInterviewsMock,
}));

async function importRoute() {
  return await import("../route");
}

function sign(secret: string, rawBody: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const hmac = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

describe("POST /api/webhooks/intervuebox", () => {
  beforeEach(() => {
    vi.stubEnv("INTERVUEBOX_WEBHOOK_SECRET", "whsec_test");
    sweepPendingInterviewsMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when the signature is missing", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/webhooks/intervuebox", {
      method: "POST",
      body: JSON.stringify({ eventType: "AIInterviewReportGenerated" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(sweepPendingInterviewsMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the signature doesn't match", async () => {
    const { POST } = await importRoute();
    const rawBody = JSON.stringify({ eventType: "AIInterviewReportGenerated" });
    const request = new Request("http://localhost/api/webhooks/intervuebox", {
      method: "POST",
      headers: { "x-ib-signature": "t=1700000000,v1=deadbeef" },
      body: rawBody,
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 401 when the timestamp is outside the 5-minute replay window", async () => {
    const { POST } = await importRoute();
    const rawBody = JSON.stringify({ eventType: "AIInterviewReportGenerated" });
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const request = new Request("http://localhost/api/webhooks/intervuebox", {
      method: "POST",
      headers: { "x-ib-signature": sign("whsec_test", rawBody, staleTimestamp) },
      body: rawBody,
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("delegates to sweepPendingInterviews and returns 200 on a valid signature", async () => {
    const { POST } = await importRoute();
    const rawBody = JSON.stringify({ eventType: "AIInterviewReportGenerated" });
    const request = new Request("http://localhost/api/webhooks/intervuebox", {
      method: "POST",
      headers: { "x-ib-signature": sign("whsec_test", rawBody) },
      body: rawBody,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(sweepPendingInterviewsMock).toHaveBeenCalledTimes(1);
  });
});
