import { describe, it, expect } from "vitest";
import { buildOrderHistoryRows, PROFILE_CONTEXT, type RazorpayTransactionRow, type LeadContext } from "../orderHistory";

function tx(overrides: Partial<RazorpayTransactionRow>): RazorpayTransactionRow {
  return {
    order_id: "order_1",
    product: "report",
    amount_paise: 29900,
    status: "success",
    lead_id: null,
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildOrderHistoryRows", () => {
  it("keeps only successful transactions, dropping initiated and failed ones", () => {
    const rows = buildOrderHistoryRows(
      [
        tx({ order_id: "a", status: "success" }),
        tx({ order_id: "b", status: "initiated" }),
        tx({ order_id: "c", status: "failed" }),
      ],
      new Map()
    );
    expect(rows.map((r) => r.id)).toEqual(["a"]);
  });

  it("labels the product from PRODUCT_LABELS and formats the amount", () => {
    const rows = buildOrderHistoryRows([tx({ product: "interview", amount_paise: 99900 })], new Map());
    expect(rows[0].item).toBe("Mock AI Interview");
    expect(rows[0].amountLabel).toBe("₹999");
  });

  it("resolves context to the lead's role_title when lead_id matches a known lead", () => {
    const leadsById = new Map<string, LeadContext>([["lead-1", { role_title: "Backend Engineer" }]]);
    const rows = buildOrderHistoryRows([tx({ lead_id: "lead-1" })], leadsById);
    expect(rows[0].context).toBe("Backend Engineer");
  });

  it("falls back to 'Your profile' when lead_id is null (candidate-level product)", () => {
    const rows = buildOrderHistoryRows([tx({ lead_id: null })], new Map());
    expect(rows[0].context).toBe(PROFILE_CONTEXT);
  });

  it("falls back to 'Your profile' when lead_id is set but the lead can't be resolved", () => {
    const rows = buildOrderHistoryRows([tx({ lead_id: "missing-lead" })], new Map());
    expect(rows[0].context).toBe(PROFILE_CONTEXT);
  });

  it("formats the date as day/short-month/year", () => {
    const rows = buildOrderHistoryRows([tx({ created_at: "2026-03-05T00:00:00.000Z" })], new Map());
    expect(rows[0].dateLabel).toBe("5 Mar 2026");
  });

  it("sorts rows newest-first regardless of input order", () => {
    const rows = buildOrderHistoryRows(
      [
        tx({ order_id: "old", created_at: "2026-01-01T00:00:00.000Z" }),
        tx({ order_id: "new", created_at: "2026-06-01T00:00:00.000Z" }),
      ],
      new Map()
    );
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });
});
