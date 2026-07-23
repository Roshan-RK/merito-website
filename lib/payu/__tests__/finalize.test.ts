import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyResponseHashMock = vi.fn();
vi.mock("@/lib/payu/client", () => ({
  verifyResponseHash: verifyResponseHashMock,
}));

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

function buildFields(overrides: Partial<Record<string, string>> = {}) {
  return {
    key: "testkey",
    txnid: "txn-1",
    amount: "299.00",
    productinfo: "Detailed Report",
    firstname: "Rushi",
    email: "rushi@example.com",
    status: "success",
    hash: "somehash",
    ...overrides,
  };
}

describe("finalizePaymentFromPayu", () => {
  beforeEach(() => {
    verifyResponseHashMock.mockReset();
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

  it("rejects with invalid_hash when the hash doesn't verify, without touching Supabase", async () => {
    verifyResponseHashMock.mockReturnValue(false);
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields());

    expect(result).toEqual({ ok: false, reason: "invalid_hash" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects with unknown_txn when no payu_transactions row matches", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    txnMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields());

    expect(result).toEqual({ ok: false, reason: "unknown_txn" });
    expect(unlockReportMock).not.toHaveBeenCalled();
  });

  it("marks the transaction failed and rejects with payment_failed on a non-success status", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "report", lead_id: "lead-1", status: "initiated" },
      error: null,
    });
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields({ status: "failure" }));

    expect(result).toEqual({ ok: false, reason: "payment_failed" });
    expect(updateMock).toHaveBeenCalledWith({ status: "failed" });
    expect(updateEqMock).toHaveBeenCalledWith("txnid", "txn-1");
    expect(unlockReportMock).not.toHaveBeenCalled();
  });

  it("unlocks the report and marks the transaction success on first success", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "report", lead_id: "lead-1", status: "initiated" },
      error: null,
    });
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields());

    expect(result).toEqual({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
    expect(updateMock).toHaveBeenCalledWith({ status: "success" });
    expect(unlockReportMock).toHaveBeenCalledWith("user-1", "lead-1");
  });

  it("is idempotent — a second success callback doesn't call unlockReport again", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "report", lead_id: "lead-1", status: "success" },
      error: null,
    });
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields());

    expect(result).toEqual({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
    expect(unlockReportMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does not mark the transaction success if unlockReport throws (retry-safety)", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    unlockReportMock.mockRejectedValue(new Error("transient supabase error"));
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "report", lead_id: "lead-1", status: "initiated" },
      error: null,
    });
    const { finalizePaymentFromPayu } = await import("../finalize");

    await expect(finalizePaymentFromPayu(buildFields())).rejects.toThrow("transient supabase error");

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects with unsupported_product for any product other than report", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "personality", lead_id: null, status: "initiated" },
      error: null,
    });
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields());

    expect(result).toEqual({ ok: false, reason: "unsupported_product" });
  });
});
