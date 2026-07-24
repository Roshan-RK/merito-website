import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

const verifyPaymentSignatureMock = vi.fn();
vi.mock("@/lib/razorpay/client", () => ({
  verifyPaymentSignature: verifyPaymentSignatureMock,
}));

const finalizeRazorpayOrderMock = vi.fn();
vi.mock("@/lib/razorpay/finalize", () => ({
  finalizeRazorpayOrder: finalizeRazorpayOrderMock,
}));

const completeReportUnlockMock = vi.fn();
vi.mock("@/lib/completeReportUnlock", () => ({
  completeReportUnlock: completeReportUnlockMock,
}));

const leadMaybeSingleMock = vi.fn();
const leadEqMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEqMock });
const adminFromMock = vi.fn().mockReturnValue({ select: leadSelectMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: adminFromMock }),
}));

async function importRoute() {
  return await import("../route");
}

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/hub/razorpay/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/hub/razorpay/verify", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    verifyPaymentSignatureMock.mockReset();
    finalizeRazorpayOrderMock.mockReset();
    completeReportUnlockMock.mockReset();
    leadMaybeSingleMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ orderId: "order_1", paymentId: "pay_1", signature: "sig" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when a required field is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ orderId: "order_1", paymentId: "pay_1" }));
    expect(response.status).toBe(400);
    expect(verifyPaymentSignatureMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the signature doesn't verify, without calling finalize", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyPaymentSignatureMock.mockReturnValue(false);
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ orderId: "order_1", paymentId: "pay_1", signature: "sig" }));
    expect(response.status).toBe(400);
    expect(finalizeRazorpayOrderMock).not.toHaveBeenCalled();
  });

  it("returns 400 when finalize rejects the order", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyPaymentSignatureMock.mockReturnValue(true);
    finalizeRazorpayOrderMock.mockResolvedValue({ ok: false, reason: "unknown_order" });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ orderId: "order_1", paymentId: "pay_1", signature: "sig" }));
    expect(response.status).toBe(400);
  });

  it("does not leak report content when the finalized order belongs to a different user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyPaymentSignatureMock.mockReturnValue(true);
    finalizeRazorpayOrderMock.mockResolvedValue({ ok: true, product: "report", userId: "someone-else", leadId: "lead-1" });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ orderId: "order_1", paymentId: "pay_1", signature: "sig" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "unlocked" });
    expect(completeReportUnlockMock).not.toHaveBeenCalled();
  });

  it("fetches the lead and returns the unlocked report on success", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyPaymentSignatureMock.mockReturnValue(true);
    finalizeRazorpayOrderMock.mockResolvedValue({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
    leadMaybeSingleMock.mockResolvedValue({
      data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "READY", resume_match_raw: { summary: "Good fit." } },
      error: null,
    });
    const storedReport = { summary: "Good fit." };
    completeReportUnlockMock.mockResolvedValue({ status: "unlocked", report: storedReport });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ orderId: "order_1", paymentId: "pay_1", signature: "sig" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(completeReportUnlockMock).toHaveBeenCalledWith("user-1", expect.objectContaining({ id: "lead-1" }));
    expect(body).toEqual({ status: "unlocked", report: storedReport });
  });

  it("returns requested for a counselling order, without touching completeReportUnlock", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyPaymentSignatureMock.mockReturnValue(true);
    finalizeRazorpayOrderMock.mockResolvedValue({ ok: true, product: "counselling", userId: "user-1", leadId: null });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ orderId: "order_1", paymentId: "pay_1", signature: "sig" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "requested" });
    expect(completeReportUnlockMock).not.toHaveBeenCalled();
  });

  it("returns pending when completeReportUnlock reports pending", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    verifyPaymentSignatureMock.mockReturnValue(true);
    finalizeRazorpayOrderMock.mockResolvedValue({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
    leadMaybeSingleMock.mockResolvedValue({
      data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", resume_match_raw: null },
      error: null,
    });
    completeReportUnlockMock.mockResolvedValue({ status: "pending" });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ orderId: "order_1", paymentId: "pay_1", signature: "sig" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "pending" });
  });
});
