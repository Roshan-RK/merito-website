import { describe, it, expect, vi, beforeEach } from "vitest";
import { findUnpaidUnlocks } from "../adminPayments";

const { logAdminActionMock, fromMock, createRefundMock, markRazorpayRefundedMock } = vi.hoisted(() => ({
  logAdminActionMock: vi.fn(),
  fromMock: vi.fn(),
  createRefundMock: vi.fn(),
  markRazorpayRefundedMock: vi.fn(),
}));
vi.mock("@/lib/adminAuditLog", () => ({ logAdminAction: logAdminActionMock }));
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from: fromMock }) }));
vi.mock("@/lib/razorpay/client", () => ({ createRefund: createRefundMock }));
vi.mock("@/lib/razorpay/finalize", () => ({ markRazorpayRefunded: markRazorpayRefundedMock }));

describe("findUnpaidUnlocks", () => {
  it("flags a report unlock with no matching transaction", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [{ userId: "u1", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" }],
      productUnlocks: [],
      successfulTransactions: [],
    });

    expect(result).toEqual([
      { userId: "u1", kind: "report", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" },
    ]);
  });

  it("does not flag a report unlock covered by a matching report transaction", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [{ userId: "u1", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" }],
      productUnlocks: [],
      successfulTransactions: [{ userId: "u1", product: "report", leadId: "lead-1" }],
    });

    expect(result).toEqual([]);
  });

  it("does not flag a report unlock covered by a bundle transaction for the same user", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [{ userId: "u1", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" }],
      productUnlocks: [],
      successfulTransactions: [{ userId: "u1", product: "bundle", leadId: "lead-1" }],
    });

    expect(result).toEqual([]);
  });

  it("still flags a report unlock when a report transaction exists for a different lead", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [{ userId: "u1", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" }],
      productUnlocks: [],
      successfulTransactions: [{ userId: "u1", product: "report", leadId: "lead-2" }],
    });

    expect(result).toEqual([
      { userId: "u1", kind: "report", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" },
    ]);
  });

  it("flags a personality unlock with no matching transaction", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [],
      productUnlocks: [{ userId: "u1", product: "personality", unlockedAt: "2026-08-01T00:00:00Z" }],
      successfulTransactions: [],
    });

    expect(result).toEqual([
      { userId: "u1", kind: "personality", leadId: null, roleTitle: null, unlockedAt: "2026-08-01T00:00:00Z" },
    ]);
  });

  it("does not flag a personality unlock covered by a bundle transaction", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [],
      productUnlocks: [{ userId: "u1", product: "personality", unlockedAt: "2026-08-01T00:00:00Z" }],
      successfulTransactions: [{ userId: "u1", product: "bundle", leadId: "lead-1" }],
    });

    expect(result).toEqual([]);
  });

  it("does not flag a references unlock covered by a matching references transaction", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [],
      productUnlocks: [{ userId: "u1", product: "references", unlockedAt: "2026-08-01T00:00:00Z" }],
      successfulTransactions: [{ userId: "u1", product: "references", leadId: null }],
    });

    expect(result).toEqual([]);
  });

  it("ignores transactions belonging to a different user", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [],
      productUnlocks: [{ userId: "u1", product: "personality", unlockedAt: "2026-08-01T00:00:00Z" }],
      successfulTransactions: [{ userId: "u2", product: "personality", leadId: null }],
    });

    expect(result).toEqual([
      { userId: "u1", kind: "personality", leadId: null, roleTitle: null, unlockedAt: "2026-08-01T00:00:00Z" },
    ]);
  });
});

describe("recordManualReconciliation", () => {
  beforeEach(() => {
    fromMock.mockReset();
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("resolves level via leadId, inserts a manual transaction, and logs the action", async () => {
    const leadMaybeSingle = vi.fn().mockResolvedValue({ data: { candidate_level: "mid" }, error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "fitment_leads") return { select: () => ({ eq: () => ({ maybeSingle: leadMaybeSingle }) }) };
      if (table === "razorpay_transactions") return { insert: insertMock };
      throw new Error(`unexpected table ${table}`);
    });

    const { recordManualReconciliation } = await import("../adminPayments");
    await recordManualReconciliation({ userId: "user-1", leadId: "lead-1", product: "report", amountPaise: 29900 }, "rushi.humbe@gmail.com");

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        product: "report",
        level: "mid",
        lead_id: "lead-1",
        amount_paise: 29900,
        status: "success",
      })
    );
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "payment.manual_reconciliation", targetId: "user-1" })
    );
  });

  it("falls back to the user's most recent lead for level when leadId is null", async () => {
    const userLeadMaybeSingle = vi.fn().mockResolvedValue({ data: { candidate_level: "senior" }, error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "fitment_leads") {
        return { select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: userLeadMaybeSingle }) }) }) }) };
      }
      if (table === "razorpay_transactions") return { insert: insertMock };
      throw new Error(`unexpected table ${table}`);
    });

    const { recordManualReconciliation } = await import("../adminPayments");
    await recordManualReconciliation({ userId: "user-1", leadId: null, product: "personality", amountPaise: 19900 }, "rushi.humbe@gmail.com");

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ level: "senior", lead_id: null }));
  });
});

describe("refundTransaction", () => {
  beforeEach(() => {
    fromMock.mockReset();
    createRefundMock.mockReset();
    createRefundMock.mockResolvedValue({ refundId: "rfnd_1" });
    markRazorpayRefundedMock.mockReset();
    markRazorpayRefundedMock.mockResolvedValue({ ok: true, alreadyProcessed: false });
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("calls createRefund then markRazorpayRefunded and logs the action", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { order_id: "order-1", payment_id: "pay_123", user_id: "user-1", status: "success", amount_paise: 29900 },
      error: null,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "razorpay_transactions") return { select: () => ({ eq: () => ({ maybeSingle }) }) };
      throw new Error(`unexpected table ${table}`);
    });

    const { refundTransaction } = await import("../adminPayments");
    await refundTransaction("order-1", "candidate requested", "admin@merito.in");

    expect(createRefundMock).toHaveBeenCalledWith("pay_123", 29900);
    expect(markRazorpayRefundedMock).toHaveBeenCalledWith("order-1");
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ adminEmail: "admin@merito.in", action: "payment.refund", targetType: "candidate", targetId: "user-1" })
    );
  });

  it("rejects a transaction that is not in success status", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { order_id: "order-1", payment_id: "pay_123", user_id: "user-1", status: "refunded", amount_paise: 29900 },
      error: null,
    });
    fromMock.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));

    const { refundTransaction } = await import("../adminPayments");

    await expect(refundTransaction("order-1", "x", "admin@merito.in")).rejects.toThrow("not refundable");
    expect(createRefundMock).not.toHaveBeenCalled();
  });

  it("throws for an unknown order", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    fromMock.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));

    const { refundTransaction } = await import("../adminPayments");

    await expect(refundTransaction("order-x", "x", "admin@merito.in")).rejects.toThrow("not found");
  });
});
