import { getSupabaseServerClient } from "@/lib/supabase";
import { verifyResponseHash, type PayuResponseFields } from "@/lib/payu/client";
import { unlockReport } from "@/lib/reportUnlocks";
import type { PayuProduct } from "@/lib/payu/pricing";

export type FinalizeResult =
  | { ok: true; product: PayuProduct; userId: string; leadId: string | null }
  | { ok: false; reason: "invalid_hash" | "unknown_txn" | "payment_failed" | "unsupported_product" };

export async function finalizePaymentFromPayu(fields: PayuResponseFields): Promise<FinalizeResult> {
  if (!verifyResponseHash(fields)) {
    return { ok: false, reason: "invalid_hash" };
  }

  const supabase = getSupabaseServerClient();
  const { data: txn, error } = await supabase
    .from("payu_transactions")
    .select("user_id, product, lead_id, status")
    .eq("txnid", fields.txnid)
    .maybeSingle();

  if (error || !txn) {
    return { ok: false, reason: "unknown_txn" };
  }

  if (fields.status !== "success") {
    if (txn.status === "initiated") {
      await supabase.from("payu_transactions").update({ status: "failed" }).eq("txnid", fields.txnid);
    }
    return { ok: false, reason: "payment_failed" };
  }

  const product = txn.product as PayuProduct;

  // Only "report" is wired up this phase — personality/references/interview/
  // counselling/bundle each get their own case in a later plan.
  if (product !== "report") {
    return { ok: false, reason: "unsupported_product" };
  }

  if (txn.status !== "success") {
    await supabase.from("payu_transactions").update({ status: "success" }).eq("txnid", fields.txnid);
    await unlockReport(txn.user_id, txn.lead_id as string);
  }

  return { ok: true, product, userId: txn.user_id, leadId: txn.lead_id };
}
