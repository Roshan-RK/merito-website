import { getSupabaseServerClient } from "@/lib/supabase";
import { unlockReport } from "@/lib/reportUnlocks";
import type { RazorpayProduct } from "@/lib/razorpay/pricing";

export type FinalizeResult =
  | { ok: true; product: RazorpayProduct; userId: string; leadId: string | null }
  | { ok: false; reason: "unknown_order" | "unsupported_product" };

// Signature verification (payment or webhook) happens in the calling route,
// not here — Razorpay's two channels carry different payloads, so each has
// its own verify function in lib/razorpay/client.ts. This function only
// applies the *effect* of an already-authenticated payment, and does so
// idempotently: unlockReport is upsert-based, so calling it again on a
// webhook retry after a client-side verify already succeeded (or vice
// versa) is safe.
export async function finalizeRazorpayOrder(orderId: string, paymentId: string): Promise<FinalizeResult> {
  const supabase = getSupabaseServerClient();
  const { data: txn, error } = await supabase
    .from("razorpay_transactions")
    .select("user_id, product, lead_id, status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !txn) {
    return { ok: false, reason: "unknown_order" };
  }

  const product = txn.product as RazorpayProduct;

  // Only "report" is wired up this phase — personality/references/interview/
  // counselling/bundle each get their own case in a later plan.
  if (product !== "report") {
    return { ok: false, reason: "unsupported_product" };
  }

  if (txn.status !== "success") {
    // Unlock first, then mark success — if unlockReport throws (a transient
    // DB error), the row stays "initiated" and a retry genuinely re-attempts
    // the unlock instead of silently skipping it on the next call.
    await unlockReport(txn.user_id, txn.lead_id as string);
    await supabase
      .from("razorpay_transactions")
      .update({ status: "success", payment_id: paymentId })
      .eq("order_id", orderId);
  }

  return { ok: true, product, userId: txn.user_id, leadId: txn.lead_id };
}
