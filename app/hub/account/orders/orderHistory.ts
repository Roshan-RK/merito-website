import { PRODUCT_LABELS, formatPrice, type RazorpayProduct } from "@/lib/razorpay/pricing";

// Fallback shown for candidate-level products (personality/references/interview/
// counselling bought without a role attached yet) or when the lead a purchase
// pointed at can no longer be resolved.
export const PROFILE_CONTEXT = "Your profile";

export type RazorpayTransactionRow = {
  order_id: string;
  product: RazorpayProduct;
  amount_paise: number;
  status: string;
  lead_id: string | null;
  created_at: string;
};

export type LeadContext = {
  role_title: string;
};

export type OrderHistoryRow = {
  id: string;
  item: string;
  context: string;
  amountLabel: string;
  dateLabel: string;
  createdAt: string;
};

// Only 'success' rows are real completed purchases: 'initiated' is an
// abandoned/incomplete checkout that never charged the user, and 'failed' is
// a payment that didn't go through -- neither belongs in a purchase history.
export function buildOrderHistoryRows(
  transactions: RazorpayTransactionRow[],
  leadsById: Map<string, LeadContext>
): OrderHistoryRow[] {
  return transactions
    .filter((transaction) => transaction.status === "success")
    .map((transaction) => {
      const lead = transaction.lead_id ? leadsById.get(transaction.lead_id) : undefined;
      return {
        id: transaction.order_id,
        item: PRODUCT_LABELS[transaction.product],
        context: lead?.role_title || PROFILE_CONTEXT,
        amountLabel: formatPrice(transaction.amount_paise),
        dateLabel: new Date(transaction.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        createdAt: transaction.created_at,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
