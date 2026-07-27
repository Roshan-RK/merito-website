import { getSupabaseServerClient } from "@/lib/supabase";
import { unlockReport } from "@/lib/reportUnlocks";
import { unlockProduct } from "@/lib/productUnlocks";
import type { RazorpayProduct } from "@/lib/razorpay/pricing";

async function getRoleTitleForLead(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  leadId: string | null
): Promise<string | null> {
  if (!leadId) return null;
  const { data } = await supabase.from("fitment_leads").select("role_title").eq("id", leadId).maybeSingle();
  return data?.role_title ?? null;
}

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

  // "interview" is not wired up yet — a later plan.
  if (product === "interview") {
    return { ok: false, reason: "unsupported_product" };
  }

  if (txn.status !== "success") {
    // Apply the product's effect first, then mark success — if the effect
    // throws (a transient DB error), the row stays "initiated" and a retry
    // genuinely re-attempts it instead of silently skipping it next time.
    if (product === "report") {
      const roleTitle = await getRoleTitleForLead(supabase, txn.lead_id as string);
      if (roleTitle) await unlockReport(txn.user_id, roleTitle);
    } else if (product === "counselling") {
      const { error: insertError } = await supabase
        .from("counselling_requests")
        .insert({ user_id: txn.user_id, order_id: orderId });
      if (insertError) {
        throw new Error(`Failed to record counselling request: ${insertError.message}`);
      }
    } else if (product === "personality") {
      await unlockProduct(txn.user_id, "personality");
    } else if (product === "references") {
      await unlockProduct(txn.user_id, "references");
    } else if (product === "bundle") {
      const roleTitle = await getRoleTitleForLead(supabase, txn.lead_id as string);
      if (roleTitle) await unlockReport(txn.user_id, roleTitle);
      await unlockProduct(txn.user_id, "personality");
      await unlockProduct(txn.user_id, "references");
    }
    await supabase
      .from("razorpay_transactions")
      .update({ status: "success", payment_id: paymentId })
      .eq("order_id", orderId);
  }

  return { ok: true, product, userId: txn.user_id, leadId: txn.lead_id };
}

export type MarkFailedResult =
  | { ok: true; alreadyProcessed: boolean; orderId: string; amountPaise: number }
  | { ok: false; reason: "unknown_order" };

export async function markRazorpayPaymentFailed(orderId: string): Promise<MarkFailedResult> {
  const supabase = getSupabaseServerClient();
  const { data: txn, error } = await supabase
    .from("razorpay_transactions")
    .select("status, amount_paise")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !txn) {
    return { ok: false, reason: "unknown_order" };
  }

  if (txn.status !== "initiated") {
    return { ok: true, alreadyProcessed: true, orderId, amountPaise: txn.amount_paise };
  }

  await supabase.from("razorpay_transactions").update({ status: "failed" }).eq("order_id", orderId);
  return { ok: true, alreadyProcessed: false, orderId, amountPaise: txn.amount_paise };
}

export type MarkRefundedResult =
  | { ok: true; alreadyProcessed: boolean }
  | { ok: false; reason: "unknown_order" };

export async function markRazorpayRefunded(orderId: string): Promise<MarkRefundedResult> {
  const supabase = getSupabaseServerClient();
  const { data: txn, error } = await supabase
    .from("razorpay_transactions")
    .select("status, product, user_id, lead_id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !txn) {
    return { ok: false, reason: "unknown_order" };
  }

  if (txn.status !== "success" || txn.product !== "report" || !txn.lead_id) {
    return { ok: true, alreadyProcessed: true };
  }

  const roleTitle = await getRoleTitleForLead(supabase, txn.lead_id);
  if (roleTitle) {
    await supabase.from("report_unlocks").delete().eq("user_id", txn.user_id).eq("role_title", roleTitle);
  }
  await supabase.from("razorpay_transactions").update({ status: "refunded" }).eq("order_id", orderId);
  return { ok: true, alreadyProcessed: false };
}
