import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { unlockReport } from "@/lib/reportUnlocks";
import { getResumeMatchReport, scoreOutOfTen } from "@/lib/intervuebox/reports";
import { getSupabaseServerClient } from "@/lib/supabase";
import { buildPaymentForm } from "@/lib/payu/client";
import { PRODUCT_PRICING, PRODUCT_LABELS, DEFAULT_LEVEL, type CandidateLevel } from "@/lib/payu/pricing";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

function isPayuBypassed(): boolean {
  return process.env.PAYU_BYPASS !== "false";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { leadId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  if (!leadId) {
    return Response.json({ error: "leadId is required." }, { status: 400 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("id, ib_applied_job_id, resume_match_status, resume_match_raw, candidate_level")
    .eq("user_id", user.id)
    .eq("id", leadId)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ error: "No fitment check found for this lead." }, { status: 400 });
  }

  if (!isPayuBypassed()) {
    const level = (lead.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;
    const amountPaise = PRODUCT_PRICING.report[level];
    const txnid = crypto.randomUUID();

    const admin = getSupabaseServerClient();
    const { error: insertError } = await admin.from("payu_transactions").insert({
      txnid,
      user_id: user.id,
      product: "report",
      level,
      lead_id: leadId,
      amount_paise: amountPaise,
      status: "initiated",
    });

    if (insertError) {
      return Response.json({ error: "Something went wrong starting payment." }, { status: 500 });
    }

    const form = buildPaymentForm({
      txnid,
      amount: (amountPaise / 100).toFixed(2),
      productinfo: PRODUCT_LABELS.report,
      firstname: user.email?.split("@")[0] || "Candidate",
      email: user.email ?? "",
      surl: `${siteUrl}/hub/payu/return`,
      furl: `${siteUrl}/hub/payu/return`,
    });

    return Response.json({ status: "redirect", form });
  }

  try {
    await unlockReport(user.id, leadId);
  } catch {
    return Response.json({ error: "Something went wrong unlocking the report." }, { status: 500 });
  }

  if (lead.resume_match_status === "READY") {
    return Response.json({ status: "unlocked", report: lead.resume_match_raw });
  }

  let report;
  try {
    report = await getResumeMatchReport(lead.ib_applied_job_id);
  } catch {
    return Response.json({ error: "Unlocked, but the report failed to load — please refresh." }, { status: 500 });
  }

  if (report.status === "PENDING") {
    return Response.json({ status: "pending" });
  }

  const resumeMatchRaw = {
    overallScore: report.overallScore,
    rank: report.rank,
    categories: report.categories,
    summary: report.summary,
    strongPoints: report.strongPoints,
    weakPoints: report.weakPoints,
  };

  const admin = getSupabaseServerClient();
  const { error: updateError } = await admin
    .from("fitment_leads")
    .update({
      score: scoreOutOfTen(report.overallScore),
      verdict: report.summary,
      resume_match_status: "READY",
      resume_match_score: report.overallScore,
      resume_match_raw: resumeMatchRaw,
    })
    .eq("id", lead.id);

  if (updateError) {
    return Response.json({ error: "Unlocked, but the report failed to save — please refresh." }, { status: 500 });
  }

  return Response.json({ status: "unlocked", report: resumeMatchRaw });
}
