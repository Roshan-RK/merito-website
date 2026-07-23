import { describe, it, expect, vi, beforeEach } from "vitest";

const unlockReportMock = vi.fn();
vi.mock("@/lib/reportUnlocks", () => ({
  unlockReport: unlockReportMock,
}));

const txnSelectMock = vi.fn();
const txnEqMock = vi.fn();
const txnMaybeSingleMock = vi.fn();
const updateMock = vi.fn();
const updateEqMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("finalizeRazorpayOrder", () => {
  beforeEach(() => {
    unlockReportMock.mockReset();
    unlockReportMock.mockResolvedValue(undefined);
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

  it("rejects with unknown_order when no razorpay_transactions row matches", async () => {
    txnMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { finalizeRazorpayOrder } = await import("../finalize");

    const result = await finalizeRazorpayOrder("order_1", "pay_1");

    expect(result).toEqual({ ok: false, reason: "unknown_order" });
    expect(unlockReportMock).not.toHaveBeenCalled();
  });

  it("rejects with unsupported_product for any product other than report", async () => {
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "personality", lead_id: null, status: "initiated" },
      error: null,
    });
    const { finalizeRazorpayOrder } = await import("../finalize");

    const result = await finalizeRazorpayOrder("order_1", "pay_1");

    expect(result).toEqual({ ok: false, reason: "unsupported_product" });
    expect(unlockReportMock).not.toHaveBeenCalled();
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
    expect(unlockReportMock).toHaveBeenCalledWith("user-1", "lead-1");
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
    expect(deleteEq2Mock).toHaveBeenCalledWith("lead_id", "lead-1");
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
