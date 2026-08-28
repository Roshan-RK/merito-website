import { getSupabaseServerClient } from "@/lib/supabase";
import { unlockReport } from "@/lib/reportUnlocks";
import { unlockProduct, revokeProduct } from "@/lib/productUnlocks";
import { nextCounsellingState, updateCounsellingStatus, type CounsellingStatus } from "@/lib/adminCounselling";
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
// idempotently: unlockReport inserts and swallows a duplicate-key error, so calling it again on a
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

  if (txn.status !== "success") {
    // Apply the product's effect first, then mark success — if the effect
    // throws (a transient DB error), the row stays "initiated" and a retry
    // genuinely re-attempts it instead of silently skipping it next time.
    if (product === "report") {
      const roleTitle = await getRoleTitleForLead(supabase, txn.lead_id as string | null);
      if (txn.lead_id && roleTitle) {
        await unlockReport(txn.user_id, txn.lead_id as string, roleTitle);
      } else {
        // Paid, but no lead to attach the unlock to -- log at error so it
        // surfaces: the txn is about to be marked success, so no retry repairs
        // this. leadId distinguishes "null" from "set but the lead row is gone".
        console.error("finalize: report order resolved no lead for report unlock", {
          orderId,
          leadId: txn.lead_id,
          roleTitle,
        });
      }
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
      const roleTitle = await getRoleTitleForLead(supabase, txn.lead_id as string | null);
      if (txn.lead_id && roleTitle) {
        await unlockReport(txn.user_id, txn.lead_id as string, roleTitle);
      } else {
        // personality/references below still apply; only the report unlock is skipped.
        console.error("finalize: bundle order resolved no lead for report unlock", {
          orderId,
          leadId: txn.lead_id,
          roleTitle,
        });
      }
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

async function revokeReportForLead(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
  leadId: string | null
): Promise<void> {
  const roleTitle = await getRoleTitleForLead(supabase, leadId);
  if (leadId) {
    await supabase.from("report_unlocks").delete().eq("user_id", userId).eq("lead_id", leadId);
  }
  if (roleTitle) {
    // Legacy row (lead_id never backfilled) for the same role.
    await supabase.from("report_unlocks").delete().eq("user_id", userId).eq("role_title", roleTitle).is("lead_id", null);
  }
}

async function revokeCounsellingForOrder(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  orderId: string
): Promise<void> {
  const { data: request } = await supabase
    .from("counselling_requests")
    .select("id, status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!request) return;
  if (request.status !== "requested" && request.status !== "scheduled") return;
  const patch = nextCounsellingState(request.status as CounsellingStatus, "cancelled", new Date().toISOString());
  await updateCounsellingStatus(request.id, patch);
}

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

  if (txn.status !== "success") {
    return { ok: true, alreadyProcessed: true };
  }

  if (txn.product === "report") {
    await revokeReportForLead(supabase, txn.user_id, txn.lead_id);
  } else if (txn.product === "personality") {
    await revokeProduct(txn.user_id, "personality");
  } else if (txn.product === "references") {
    await revokeProduct(txn.user_id, "references");
  } else if (txn.product === "bundle") {
    await revokeReportForLead(supabase, txn.user_id, txn.lead_id);
    await revokeProduct(txn.user_id, "personality");
    await revokeProduct(txn.user_id, "references");
  } else if (txn.product === "counselling") {
    await revokeCounsellingForOrder(supabase, orderId);
  }
  // "interview": no separate table for its grant -- the status flip below,
  // which start-ai-interview checks via `status='success'`, is the entire revocation.

  await supabase.from("razorpay_transactions").update({ status: "refunded" }).eq("order_id", orderId);
  return { ok: true, alreadyProcessed: false };
}
