import crypto from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getInterviewReportMock = vi.fn();
vi.mock("@/lib/intervuebox/interviewReports", () => ({
  getInterviewReport: getInterviewReportMock,
}));

const selectEqMock = vi.fn();
const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock });
const updateEq2Mock = vi.fn().mockResolvedValue({ error: null });
const updateEq1Mock = vi.fn().mockReturnValue({ eq: updateEq2Mock });
const updateMock = vi.fn().mockReturnValue({ eq: updateEq1Mock });
const fromMock = vi.fn().mockReturnValue({ select: selectMock, update: updateMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importRoute() {
  return await import("../route");
}

function sign(secret: string, rawBody: string, timestamp = "1700000000") {
  const hmac = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

describe("POST /api/webhooks/intervuebox", () => {
  beforeEach(() => {
    vi.stubEnv("INTERVUEBOX_WEBHOOK_SECRET", "whsec_test");
    getInterviewReportMock.mockReset();
    selectEqMock.mockReset();
    updateMock.mockClear();
    updateEq1Mock.mockClear();
    updateEq2Mock.mockClear();
    updateEq2Mock.mockResolvedValue({ error: null });
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

  it("sweeps invited rows, updates the one whose report is ready, and returns 200", async () => {
    selectEqMock.mockResolvedValue({
      data: [
        { user_id: "user-1", role_title: "Senior Product Manager", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
        { user_id: "user-2", role_title: "Backend Engineer", ib_agent_id: "INT_2", ib_candidate_id: "USR_2" },
      ],
      error: null,
    });
    getInterviewReportMock.mockImplementation(async (interviewId: string) => {
      if (interviewId === "INT_1") {
        return {
          status: "READY",
          overallSkillScore: 85,
          skillReport: { technical: 85 },
          overallReport: "Strong candidate.",
          shareableReportLink: "https://app.intervuebox.com/reports/ISE_1",
        };
      }
      return { status: "NOT_READY" };
    });

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
    expect(getInterviewReportMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready" })
    );
    expect(updateEq1Mock).toHaveBeenCalledWith("user_id", "user-1");
    expect(updateEq2Mock).toHaveBeenCalledWith("role_title", "Senior Product Manager");
  });

  it("returns 200 with no updates when there are no invited rows", async () => {
    selectEqMock.mockResolvedValue({ data: [], error: null });
    const { POST } = await importRoute();
    const rawBody = JSON.stringify({ eventType: "AIInterviewReportGenerated" });
    const request = new Request("http://localhost/api/webhooks/intervuebox", {
      method: "POST",
      headers: { "x-ib-signature": sign("whsec_test", rawBody) },
      body: rawBody,
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
