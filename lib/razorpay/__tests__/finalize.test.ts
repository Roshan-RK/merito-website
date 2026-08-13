import { describe, it, expect, vi, beforeEach } from "vitest";

const unlockReportMock = vi.fn();
vi.mock("@/lib/reportUnlocks", () => ({
  unlockReport: unlockReportMock,
}));

const unlockProductMock = vi.fn();
vi.mock("@/lib/productUnlocks", () => ({
  unlockProduct: unlockProductMock,
}));

const txnSelectMock = vi.fn();
const txnEqMock = vi.fn();
const txnMaybeSingleMock = vi.fn();
const updateMock = vi.fn();
const updateEqMock = vi.fn();
const insertMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("finalizeRazorpayOrder", () => {
  beforeEach(() => {
    unlockReportMock.mockReset();
    unlockReportMock.mockResolvedValue(undefined);
    unlockProductMock.mockReset();
    unlockProductMock.mockResolvedValue(undefined);
    fromMock.mockReset();
    txnSelectMock.mockReset();
    txnEqMock.mockReset();
    txnMaybeSingleMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();
    updateEqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: updateEqMock });
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "counselling_requests") return { insert: insertMock };
      if (table === "fitment_leads") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role_title: "Senior Product Manager" }, error: null }) }),
          }),
        };
      }
      return { select: txnSelectMock, update: updateMock };
    });
    txnSelectMock.mockReturnValue({ eq: txnEqMock });
    txnEqMock.mockReturnValue({ maybeSingle: txnMaybeSingleMock });
  });

  it("rejects with unknown_order when no razorpay_transactions row matches", async () => {
    txnMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { finalizeRazorpayOrder } = await import("../finalize");

    const result = await finalizeRazorpayOrder("order_1", "pay_1");

    expect(result).toEqual({ ok: false, reason: "unknown_order" });
    expect(unlockReportMock).not.toHaveBeenCalled();
  });

  it("unlocks personality and marks success", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "personality", lead_id: null, status: "initiated" },
      error: null,
    });
    const { finalizeRazorpayOrder } = await import("../finalize");

    const result = await finalizeRazorpayOrder("order_1", "pay_1");

    expect(result).toEqual({ ok: true, product: "personality", userId: "user-1", leadId: null });
    expect(unlockProductMock).toHaveBeenCalledWith("user-1", "personality");
    expect(updateMock).toHaveBeenCalledWith({ status: "success", payment_id: "pay_1" });
  });

  it("unlocks references and marks success", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "references", lead_id: null, status: "initiated" },
      error: null,
    });
    const { finalizeRazorpayOrder } = await import("../finalize");

    const result = await finalizeRazorpayOrder("order_1", "pay_1");

    expect(result).toEqual({ ok: true, product: "references", userId: "user-1", leadId: null });
    expect(unlockProductMock).toHaveBeenCalledWith("user-1", "references");
  });

  it("unlocks the report, personality, and references for a bundle order", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "bundle", lead_id: "lead-1", status: "initiated" },
      error: null,
    });
    const { finalizeRazorpayOrder } = await import("../finalize");

    const result = await finalizeRazorpayOrder("order_1", "pay_1");

    expect(result).toEqual({ ok: true, product: "bundle", userId: "user-1", leadId: "lead-1" });
    expect(unlockReportMock).toHaveBeenCalledWith("user-1", "Senior Product Manager");
    expect(unlockProductMock).toHaveBeenCalledWith("user-1", "personality");
    expect(unlockProductMock).toHaveBeenCalledWith("user-1", "references");
    expect(updateMock).toHaveBeenCalledWith({ status: "success", payment_id: "pay_1" });
  });

  it("marks an interview transaction success (the credit becomes available to consume later)", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "interview", lead_id: null, status: "initiated" },
      error: null,
    });
    const { finalizeRazorpayOrder } = await import("../finalize");

    const result = await finalizeRazorpayOrder("order_1", "pay_1");

    expect(result).toEqual({ ok: true, product: "interview", userId: "user-1", leadId: null });
    expect(updateMock).toHaveBeenCalledWith({ status: "success", payment_id: "pay_1" });
    expect(unlockReportMock).not.toHaveBeenCalled();
    expect(unlockProductMock).not.toHaveBeenCalled();
  });

  it("unlocks the report before marking the transaction success (retry-safety)", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "report", lead_id: "lead-1", status: "initiated" },
      error: null,
    });
    const callOrder: string[] = [];
    unlockReportMock.mockImplementation(async () => {
      callOrder.push("unlock");
    });
    updateMock.mockImplementation((payload) => {
      if (payload.status === "success") callOrder.push("markSuccess");
      return { eq: updateEqMock };
    });

    const { finalizeRazorpayOrder } = await import("../finalize");
    const result = await finalizeRazorpayOrder("order_1", "pay_1");

    expect(result).toEqual({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
    expect(unlockReportMock).toHaveBeenCalledWith("user-1", "Senior Product Manager");
    expect(updateMock).toHaveBeenCalledWith({ status: "success", payment_id: "pay_1" });
    expect(callOrder).toEqual(["unlock", "markSuccess"]);
  });

  it("does not mark the transaction success if unlockReport throws (retry-safety)", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "report", lead_id: "lead-1", status: "initiated" },
      error: null,
    });
    unlockReportMock.mockRejectedValue(new Error("db blip"));

    const { finalizeRazorpayOrder } = await import("../finalize");

    await expect(finalizeRazorpayOrder("order_1", "pay_1")).rejects.toThrow("db blip");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("is idempotent — a second call for an already-success transaction doesn't re-unlock", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "report", lead_id: "lead-1", status: "success" },
      error: null,
    });
    const { finalizeRazorpayOrder } = await import("../finalize");

    const result = await finalizeRazorpayOrder("order_1", "pay_1");

    expect(result).toEqual({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
    expect(unlockReportMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("records a counselling_requests row and marks success for a counselling order", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "counselling", lead_id: null, status: "initiated" },
      error: null,
    });
    const { finalizeRazorpayOrder } = await import("../finalize");

    const result = await finalizeRazorpayOrder("order_1", "pay_1");

    expect(result).toEqual({ ok: true, product: "counselling", userId: "user-1", leadId: null });
    expect(insertMock).toHaveBeenCalledWith({ user_id: "user-1", order_id: "order_1" });
    expect(unlockReportMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({ status: "success", payment_id: "pay_1" });
  });

  it("throws and does not mark success when the counselling_requests insert fails", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "counselling", lead_id: null, status: "initiated" },
      error: null,
    });
    insertMock.mockResolvedValue({ error: { message: "db error" } });
    const { finalizeRazorpayOrder } = await import("../finalize");

    await expect(finalizeRazorpayOrder("order_1", "pay_1")).rejects.toThrow("Failed to record counselling request");
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("markRazorpayPaymentFailed", () => {
  beforeEach(() => {
    fromMock.mockReset();
    txnSelectMock.mockReset();
    txnEqMock.mockReset();
    txnMaybeSingleMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();
    updateEqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: updateEqMock });
    fromMock.mockReturnValue({ select: txnSelectMock, update: updateMock });
    txnSelectMock.mockReturnValue({ eq: txnEqMock });
    txnEqMock.mockReturnValue({ maybeSingle: txnMaybeSingleMock });
  });

  it("rejects with unknown_order when no transaction matches", async () => {
    txnMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { markRazorpayPaymentFailed } = await import("../finalize");

    const result = await markRazorpayPaymentFailed("order_1");

    expect(result).toEqual({ ok: false, reason: "unknown_order" });
  });

  it("marks a still-initiated transaction failed", async () => {
    txnMaybeSingleMock.mockResolvedValue({ data: { status: "initiated", amount_paise: 29900 }, error: null });
    const { markRazorpayPaymentFailed } = await import("../finalize");

    const result = await markRazorpayPaymentFailed("order_1");

    expect(result).toEqual({ ok: true, alreadyProcessed: false, orderId: "order_1", amountPaise: 29900 });
    expect(updateMock).toHaveBeenCalledWith({ status: "failed" });
    expect(updateEqMock).toHaveBeenCalledWith("order_id", "order_1");
  });

  it("is idempotent — a transaction already marked failed is not updated again", async () => {
    txnMaybeSingleMock.mockResolvedValue({ data: { status: "failed", amount_paise: 29900 }, error: null });
    const { markRazorpayPaymentFailed } = await import("../finalize");

    const result = await markRazorpayPaymentFailed("order_1");

    expect(result).toEqual({ ok: true, alreadyProcessed: true, orderId: "order_1", amountPaise: 29900 });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does not touch an already-success transaction (a late failure webhook after success)", async () => {
    txnMaybeSingleMock.mockResolvedValue({ data: { status: "success", amount_paise: 29900 }, error: null });
    const { markRazorpayPaymentFailed } = await import("../finalize");

    const result = await markRazorpayPaymentFailed("order_1");

    expect(result).toEqual({ ok: true, alreadyProcessed: true, orderId: "order_1", amountPaise: 29900 });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("markRazorpayRefunded", () => {
  const deleteEq2Mock = vi.fn();
  const deleteEq1Mock = vi.fn().mockReturnValue({ eq: deleteEq2Mock });
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEq1Mock });

  beforeEach(() => {
    fromMock.mockReset();
    txnSelectMock.mockReset();
    txnEqMock.mockReset();
    txnMaybeSingleMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();
    updateEqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: updateEqMock });
    deleteMock.mockClear();
    deleteEq1Mock.mockClear();
    deleteEq2Mock.mockReset();
    deleteEq2Mock.mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "report_unlocks") return { delete: deleteMock };
      if (table === "fitment_leads") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role_title: "Senior Product Manager" }, error: null }) }),
          }),
        };
      }
      return { select: txnSelectMock, update: updateMock };
    });
    txnSelectMock.mockReturnValue({ eq: txnEqMock });
    txnEqMock.mockReturnValue({ maybeSingle: txnMaybeSingleMock });
  });

  it("rejects with unknown_order when no transaction matches", async () => {
    txnMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { markRazorpayRefunded } = await import("../finalize");

    const result = await markRazorpayRefunded("order_1");

    expect(result).toEqual({ ok: false, reason: "unknown_order" });
  });

  it("revokes the report unlock and marks the transaction refunded when it was success", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { status: "success", product: "report", user_id: "user-1", lead_id: "lead-1" },
      error: null,
    });
    const { markRazorpayRefunded } = await import("../finalize");

    const result = await markRazorpayRefunded("order_1");

    expect(result).toEqual({ ok: true, alreadyProcessed: false });
    expect(deleteEq1Mock).toHaveBeenCalledWith("user_id", "user-1");
    expect(deleteEq2Mock).toHaveBeenCalledWith("role_title", "Senior Product Manager");
    expect(updateMock).toHaveBeenCalledWith({ status: "refunded" });
  });

  it("is idempotent — an already-refunded transaction is not revoked again", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { status: "refunded", product: "report", user_id: "user-1", lead_id: "lead-1" },
      error: null,
    });
    const { markRazorpayRefunded } = await import("../finalize");

    const result = await markRazorpayRefunded("order_1");

    expect(result).toEqual({ ok: true, alreadyProcessed: true });
    expect(deleteMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("flips an interview transaction to refunded (closes the free-interview double-dip)", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { status: "success", product: "interview", user_id: "user-1", lead_id: null },
      error: null,
    });
    const { markRazorpayRefunded } = await import("../finalize");

    const result = await markRazorpayRefunded("order_1");

    expect(result).toEqual({ ok: true, alreadyProcessed: false });
    expect(updateMock).toHaveBeenCalledWith({ status: "refunded" });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("does not revoke a transaction that was never actually successful", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { status: "initiated", product: "report", user_id: "user-1", lead_id: "lead-1" },
      error: null,
    });
    const { markRazorpayRefunded } = await import("../finalize");

    const result = await markRazorpayRefunded("order_1");

    expect(result).toEqual({ ok: true, alreadyProcessed: true });
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
