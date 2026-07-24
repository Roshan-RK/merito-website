import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getUserMock = vi.fn();
const leadSelectMock = vi.fn();
const leadEq1Mock = vi.fn();
const leadEq2Mock = vi.fn();
const leadMaybeSingleMock = vi.fn();
const sessionFromMock = vi.fn();

const completeReportUnlockMock = vi.fn();
const createOrderMock = vi.fn();

const insertMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: sessionFromMock,
  }),
}));
vi.mock("@/lib/completeReportUnlock", () => ({
  completeReportUnlock: completeReportUnlockMock,
}));
vi.mock("@/lib/razorpay/client", () => ({
  createOrder: createOrderMock,
}));
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: adminFromMock }),
}));

function buildLeadChain(result: { data: unknown; error: unknown }) {
  sessionFromMock.mockReturnValue({ select: leadSelectMock });
  leadSelectMock.mockReturnValue({ eq: leadEq1Mock });
  leadEq1Mock.mockReturnValue({ eq: leadEq2Mock });
  leadEq2Mock.mockReturnValue({ maybeSingle: leadMaybeSingleMock });
  leadMaybeSingleMock.mockResolvedValue(result);
}

async function importRoute() {
  return await import("../route");
}

describe("POST /api/hub/unlock-report", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    sessionFromMock.mockReset();
    leadSelectMock.mockReset();
    leadEq1Mock.mockReset();
    leadEq2Mock.mockReset();
    leadMaybeSingleMock.mockReset();
    completeReportUnlockMock.mockReset();
    createOrderMock.mockReset();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    adminFromMock.mockReset();
    adminFromMock.mockReturnValue({ insert: insertMock });
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ leadId: "lead-1" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when leadId is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when the lead doesn't belong to this user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({ data: null, error: null });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ leadId: "someone-elses-lead" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(leadEq1Mock).toHaveBeenCalledWith("user_id", "user-123");
    expect(leadEq2Mock).toHaveBeenCalledWith("id", "someone-elses-lead");
  });

  describe("bypass path (RAZORPAY_BYPASS unset, defaults true)", () => {
    it("delegates to completeReportUnlock and returns its unlocked result", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
      const storedRaw = { overallScore: 78, rank: 1, categories: [], summary: "Good fit.", strongPoints: [], weakPoints: [] };
      buildLeadChain({
        data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "READY", resume_match_raw: storedRaw, candidate_level: "entry" },
        error: null,
      });
      completeReportUnlockMock.mockResolvedValue({ status: "unlocked", report: storedRaw });

      const { POST } = await importRoute();
      const request = new Request("http://localhost/api/hub/unlock-report", {
        method: "POST",
        body: JSON.stringify({ leadId: "lead-1" }),
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(completeReportUnlockMock).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({ id: "lead-1", ib_applied_job_id: "APJ_1" }),
        "report"
      );
      expect(createOrderMock).not.toHaveBeenCalled();
      expect(body).toEqual({ status: "unlocked", report: storedRaw });
    });

    it("returns pending when completeReportUnlock reports pending", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
      buildLeadChain({
        data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", resume_match_raw: null, candidate_level: "entry" },
        error: null,
      });
      completeReportUnlockMock.mockResolvedValue({ status: "pending" });

      const { POST } = await importRoute();
      const request = new Request("http://localhost/api/hub/unlock-report", {
        method: "POST",
        body: JSON.stringify({ leadId: "lead-1" }),
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ status: "pending" });
    });

    it("returns 500 when completeReportUnlock reports an error", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
      buildLeadChain({
        data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", resume_match_raw: null, candidate_level: "entry" },
        error: null,
      });
      completeReportUnlockMock.mockResolvedValue({ status: "error", message: "boom" });

      const { POST } = await importRoute();
      const request = new Request("http://localhost/api/hub/unlock-report", {
        method: "POST",
        body: JSON.stringify({ leadId: "lead-1" }),
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe("live path (RAZORPAY_BYPASS=false)", () => {
    beforeEach(() => {
      process.env.RAZORPAY_BYPASS = "false";
      process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    });

    afterEach(() => {
      delete process.env.RAZORPAY_BYPASS;
      delete process.env.RAZORPAY_KEY_ID;
    });

    it("creates a Razorpay order, inserts a pending razorpay_transactions row, and returns checkout details instead of unlocking", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user-123", email: "rushi@example.com" } } });
      buildLeadChain({
        data: { id: "lead-1", role_title: "Senior Product Manager", candidate_level: "mid", ib_applied_job_id: "APJ_1", resume_match_status: "READY", resume_match_raw: {} },
        error: null,
      });
      createOrderMock.mockResolvedValue({ orderId: "order_ABC123" });

      const { POST } = await importRoute();
      const request = new Request("http://localhost/api/hub/unlock-report", {
        method: "POST",
        body: JSON.stringify({ leadId: "lead-1" }),
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("checkout");
      expect(body.orderId).toBe("order_ABC123");
      expect(body.amountPaise).toBe(29900);
      expect(body.currency).toBe("INR");
      expect(body.keyId).toBe("rzp_test_key");
      expect(createOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({ amountPaise: 29900, currency: "INR" })
      );
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: "order_ABC123",
          user_id: "user-123",
          product: "report",
          lead_id: "lead-1",
          level: "mid",
          status: "initiated",
        })
      );
      expect(completeReportUnlockMock).not.toHaveBeenCalled();
    });

    it("looks up the bundle price and inserts a bundle transaction when product is 'bundle'", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user-123", email: "rushi@example.com" } } });
      buildLeadChain({
        data: { id: "lead-1", role_title: "Senior Product Manager", candidate_level: "entry", ib_applied_job_id: "APJ_1", resume_match_status: "READY", resume_match_raw: {} },
        error: null,
      });
      createOrderMock.mockResolvedValue({ orderId: "order_ABC123" });

      const { POST } = await importRoute();
      const request = new Request("http://localhost/api/hub/unlock-report", {
        method: "POST",
        body: JSON.stringify({ leadId: "lead-1", product: "bundle" }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("checkout");
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ product: "bundle", amount_paise: 89700 })
      );
    });

    it("returns 500 when the pending transaction insert fails", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "user-123", email: "rushi@example.com" } } });
      buildLeadChain({
        data: { id: "lead-1", candidate_level: "entry", ib_applied_job_id: "APJ_1", resume_match_status: "READY", resume_match_raw: {} },
        error: null,
      });
      createOrderMock.mockResolvedValue({ orderId: "order_ABC123" });
      insertMock.mockResolvedValue({ error: { message: "db error" } });

      const { POST } = await importRoute();
      const request = new Request("http://localhost/api/hub/unlock-report", {
        method: "POST",
        body: JSON.stringify({ leadId: "lead-1" }),
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
