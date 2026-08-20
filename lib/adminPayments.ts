import { randomUUID } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { logAdminAction } from "@/lib/adminAuditLog";
import { createRefund } from "@/lib/razorpay/client";
import { markRazorpayRefunded } from "@/lib/razorpay/finalize";
import { unlockProduct, isProductUnlocked } from "@/lib/productUnlocks";
import { completeReportUnlock } from "@/lib/completeReportUnlock";
import type { RazorpayProduct, CandidateLevel } from "@/lib/razorpay/pricing";

export type TransactionStatus = "initiated" | "success" | "failed" | "refunded";

export type TransactionRow = {
  orderId: string;
  paymentId: string | null;
  userId: string;
  email: string;
  product: string;
  roleTitle: string | null;
  level: string;
  amountPaise: number;
  status: TransactionStatus;
  createdAt: string;
};

type ReportUnlockInput = { userId: string; leadId: string; roleTitle: string; unlockedAt: string };
type ProductUnlockInput = { userId: string; product: "personality" | "references"; unlockedAt: string };
type SuccessfulTransactionInput = { userId: string; product: string; leadId: string | null };

export type UnpaidUnlock = {
  userId: string;
  kind: "report" | "personality" | "references";
  leadId: string | null;
  roleTitle: string | null;
  unlockedAt: string;
};

export function findUnpaidUnlocks(input: {
  reportUnlocks: ReportUnlockInput[];
  productUnlocks: ProductUnlockInput[];
  successfulTransactions: SuccessfulTransactionInput[];
}): UnpaidUnlock[] {
  const bundleCoveredUsers = new Set(input.successfulTransactions.filter((t) => t.product === "bundle").map((t) => t.userId));
  const reportCoveredPairs = new Set(
    input.successfulTransactions.filter((t) => t.product === "report").map((t) => `${t.userId}:${t.leadId}`)
  );
  const personalityCoveredUsers = new Set(input.successfulTransactions.filter((t) => t.product === "personality").map((t) => t.userId));
  const referencesCoveredUsers = new Set(input.successfulTransactions.filter((t) => t.product === "references").map((t) => t.userId));

  const unpaid: UnpaidUnlock[] = [];

  for (const r of input.reportUnlocks) {
    const covered = bundleCoveredUsers.has(r.userId) || reportCoveredPairs.has(`${r.userId}:${r.leadId}`);
    if (!covered) {
      unpaid.push({ userId: r.userId, kind: "report", leadId: r.leadId, roleTitle: r.roleTitle, unlockedAt: r.unlockedAt });
    }
  }

  for (const p of input.productUnlocks) {
    const coveredUsers = p.product === "personality" ? personalityCoveredUsers : referencesCoveredUsers;
    const covered = bundleCoveredUsers.has(p.userId) || coveredUsers.has(p.userId);
    if (!covered) {
      unpaid.push({ userId: p.userId, kind: p.product, leadId: null, roleTitle: null, unlockedAt: p.unlockedAt });
    }
  }

  return unpaid;
}

export async function listTransactions(): Promise<TransactionRow[]> {
  const supabase = getSupabaseServerClient();

  const [{ data: txnRows }, { data: leadRows }] = await Promise.all([
    supabase
      .from("razorpay_transactions")
      .select("order_id, payment_id, user_id, product, level, lead_id, amount_paise, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("fitment_leads").select("id, user_id, email, role_title"),
  ]);

  const emailByUser = new Map<string, string>();
  const roleByLead = new Map<string, string>();
  for (const lead of leadRows ?? []) {
    emailByUser.set(lead.user_id, lead.email);
    roleByLead.set(lead.id, lead.role_title);
  }

  return (txnRows ?? []).map((t) => ({
    orderId: t.order_id,
    paymentId: t.payment_id,
    userId: t.user_id,
    email: emailByUser.get(t.user_id) ?? "—",
    product: t.product,
    roleTitle: t.lead_id ? (roleByLead.get(t.lead_id) ?? null) : null,
    level: t.level,
    amountPaise: t.amount_paise,
    status: t.status as TransactionStatus,
    createdAt: t.created_at,
  }));
}

export type UnpaidUnlockRow = UnpaidUnlock & { email: string };

export async function listUnpaidUnlocks(): Promise<UnpaidUnlockRow[]> {
  const supabase = getSupabaseServerClient();

  const [{ data: reportRows }, { data: productRows }, { data: txnRows }, { data: leadRows }] = await Promise.all([
    supabase.from("report_unlocks").select("user_id, lead_id, unlocked_at"),
    supabase.from("product_unlocks").select("user_id, product, unlocked_at"),
    supabase.from("razorpay_transactions").select("user_id, product, lead_id").eq("status", "success"),
    supabase.from("fitment_leads").select("id, user_id, email, role_title"),
  ]);

  const emailByUser = new Map<string, string>();
  const roleByLead = new Map<string, string>();
  for (const lead of leadRows ?? []) {
    emailByUser.set(lead.user_id, lead.email);
    roleByLead.set(lead.id, lead.role_title);
  }

  const unpaid = findUnpaidUnlocks({
    reportUnlocks: (reportRows ?? []).map((r) => ({
      userId: r.user_id,
      leadId: r.lead_id,
      roleTitle: roleByLead.get(r.lead_id) ?? "—",
      unlockedAt: r.unlocked_at,
    })),
    productUnlocks: (productRows ?? []).map((p) => ({ userId: p.user_id, product: p.product, unlockedAt: p.unlocked_at })),
    successfulTransactions: (txnRows ?? []).map((t) => ({ userId: t.user_id, product: t.product, leadId: t.lead_id })),
  });

  return unpaid.map((u) => ({ ...u, email: emailByUser.get(u.userId) ?? "—" }));
}

export async function recordManualReconciliation(
  params: { userId: string; leadId: string | null; product: string; amountPaise: number },
  adminEmail: string
): Promise<void> {
  const supabase = getSupabaseServerClient();

  let level: string | null = null;
  if (params.leadId) {
    const { data } = await supabase.from("fitment_leads").select("candidate_level").eq("id", params.leadId).maybeSingle();
    level = data?.candidate_level ?? null;
  }
  if (!level) {
    const { data } = await supabase
      .from("fitment_leads")
      .select("candidate_level")
      .eq("user_id", params.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    level = data?.candidate_level ?? null;
  }
  if (!level) {
    throw new Error("Could not determine candidate level for this reconciliation.");
  }

  const orderId = `manual_${randomUUID()}`;
  const { error } = await supabase.from("razorpay_transactions").insert({
    order_id: orderId,
    user_id: params.userId,
    product: params.product,
    level,
    lead_id: params.leadId,
    amount_paise: params.amountPaise,
    status: "success",
    consumed_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`Failed to record manual reconciliation: ${error.message}`);
  }

  await logAdminAction({
    adminEmail,
    action: "payment.manual_reconciliation",
    targetType: "candidate",
    targetId: params.userId,
    priorValue: null,
    newValue: { orderId, product: params.product, amountPaise: params.amountPaise, leadId: params.leadId },
  });
}

export async function refundTransaction(orderId: string, reason: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { data: txn, error } = await supabase
    .from("razorpay_transactions")
    .select("order_id, payment_id, user_id, status, amount_paise")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !txn) {
    throw new Error("Transaction not found.");
  }
  if (txn.status !== "success") {
    throw new Error(`Transaction is not refundable in its current state (${txn.status}).`);
  }
  if (!txn.payment_id) {
    throw new Error("Transaction has no associated payment to refund.");
  }

  await createRefund(txn.payment_id, txn.amount_paise);
  await markRazorpayRefunded(orderId);

  await logAdminAction({
    adminEmail,
    action: "payment.refund",
    targetType: "candidate",
    targetId: txn.user_id,
    priorValue: { status: "success" },
    newValue: { status: "refunded", reason, orderId, amountPaise: txn.amount_paise },
  });
}

export async function voidStuckTransaction(orderId: string, adminEmail: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { data: txn, error } = await supabase
    .from("razorpay_transactions")
    .select("order_id, user_id, status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error || !txn) {
    throw new Error("Transaction not found.");
  }
  if (txn.status !== "initiated") {
    throw new Error(`Only initiated transactions can be voided (current status: ${txn.status}).`);
  }

  const { error: updateError } = await supabase.from("razorpay_transactions").update({ status: "failed" }).eq("order_id", orderId);
  if (updateError) {
    throw new Error(`Failed to void transaction: ${updateError.message}`);
  }

  await logAdminAction({
    adminEmail,
    action: "payment.void",
    targetType: "candidate",
    targetId: txn.user_id,
    priorValue: { status: "initiated" },
    newValue: { status: "failed", orderId },
  });
}

export type ResolvedCandidate = { userId: string; leadId: string | null; roleTitle: string | null };

export async function resolveCandidateByEmail(email: string): Promise<ResolvedCandidate | null> {
  const supabase = getSupabaseServerClient();
  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("id, user_id, role_title")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lead) return null;
  return { userId: lead.user_id, leadId: lead.id, roleTitle: lead.role_title };
}

export async function grantFreeAccess(
  params: { email: string; product: RazorpayProduct; level: CandidateLevel; reason: string },
  adminEmail: string
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const candidate = await resolveCandidateByEmail(params.email);

  const needsLead = params.product === "report" || params.product === "bundle";
  if (needsLead && !candidate) {
    throw new Error(`Candidate has no fitment lead — can't grant ${params.product} without one.`);
  }
  if (!candidate) {
    throw new Error("No candidate found for that email.");
  }

  const userId = candidate.userId;

  if (params.product === "personality" || params.product === "references") {
    if (await isProductUnlocked(userId, params.product)) {
      throw new Error(`Candidate already has ${params.product} unlocked.`);
    }
  }

  const consumedAt = params.product === "interview" ? null : new Date().toISOString();
  const orderId = `comp_${randomUUID()}`;

  const { error: insertError } = await supabase.from("razorpay_transactions").insert({
    order_id: orderId,
    user_id: userId,
    product: params.product,
    level: params.level,
    lead_id: candidate.leadId,
    amount_paise: 0,
    status: "success",
    consumed_at: consumedAt,
  });
  if (insertError) {
    throw new Error(`Failed to record comp grant: ${insertError.message}`);
  }

  if (params.product === "report" || params.product === "bundle") {
    const { data: leadRow } = await supabase
      .from("fitment_leads")
      .select("id, role_title, ib_applied_job_id, resume_match_status, resume_match_raw")
      .eq("id", candidate.leadId)
      .maybeSingle();
    if (leadRow) {
      await completeReportUnlock(userId, leadRow, params.product === "bundle" ? "bundle" : "report");
    }
  } else if (params.product === "personality") {
    await unlockProduct(userId, "personality");
  } else if (params.product === "references") {
    await unlockProduct(userId, "references");
  } else if (params.product === "counselling") {
    await supabase.from("counselling_requests").insert({ user_id: userId, order_id: orderId });
  }
  // "interview": the $0 success/unconsumed row inserted above is itself the credit.

  await logAdminAction({
    adminEmail,
    action: "payment.grant_free_access",
    targetType: "candidate",
    targetId: userId,
    priorValue: null,
    newValue: { product: params.product, level: params.level, reason: params.reason, orderId },
  });
}
