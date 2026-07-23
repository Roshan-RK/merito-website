import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { verifyPaymentSignature } from "@/lib/razorpay/client";
import { finalizeRazorpayOrder } from "@/lib/razorpay/finalize";
import { completeReportUnlock } from "@/lib/completeReportUnlock";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { orderId?: string; paymentId?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { orderId, paymentId, signature } = body;
  if (!orderId || !paymentId || !signature) {
    return Response.json({ error: "orderId, paymentId, and signature are required." }, { status: 400 });
  }

  if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
    return Response.json({ error: "Invalid payment signature." }, { status: 400 });
  }

  const result = await finalizeRazorpayOrder(orderId, paymentId);

  if (!result.ok) {
    return Response.json({ error: "Payment could not be verified." }, { status: 400 });
  }

  // finalizeRazorpayOrder always unlocks the transaction's own user_id, not
  // whoever calls this route — so the unlock itself is already correct even
  // if a different signed-in user somehow posted these values. This check
  // only stops that caller from receiving someone else's report content.
  if (result.userId !== user.id || result.leadId === null) {
    return Response.json({ status: "unlocked" });
  }

  const admin = getSupabaseServerClient();
  const { data: lead, error: leadError } = await admin
    .from("fitment_leads")
    .select("id, ib_applied_job_id, resume_match_status, resume_match_raw")
    .eq("id", result.leadId)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ status: "unlocked" });
  }

  // unlockReport was already called by finalizeRazorpayOrder (idempotent
  // upsert) — reusing completeReportUnlock here is just the simplest way to
  // reuse its "fetch + cache the report" logic, not a required second unlock.
  const reportResult = await completeReportUnlock(user.id, lead);

  if (reportResult.status === "error") {
    return Response.json({ status: "unlocked" });
  }
  if (reportResult.status === "pending") {
    return Response.json({ status: "pending" });
  }
  return Response.json({ status: "unlocked", report: reportResult.report });
}
