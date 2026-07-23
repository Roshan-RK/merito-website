import { getSupabaseServerClient } from "@/lib/supabase";
import { unlockReport } from "@/lib/reportUnlocks";
import { getResumeMatchReport, scoreOutOfTen, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";

export type CompleteReportUnlockResult =
  | { status: "unlocked"; report: ResumeMatchReportReady }
  | { status: "pending" }
  | { status: "error"; message: string };

export type UnlockableLead = {
  id: string;
  ib_applied_job_id: string;
  resume_match_status: string;
  resume_match_raw: unknown;
};

// Shared by the bypass path (app/api/hub/unlock-report) and the live-payment
// verify path (app/api/hub/razorpay/verify) — both need to record the
// report_unlocks row and then hand back the actual report content, fetching
// and caching it on fitment_leads if it wasn't already generated.
export async function completeReportUnlock(userId: string, lead: UnlockableLead): Promise<CompleteReportUnlockResult> {
  try {
    await unlockReport(userId, lead.id);
  } catch {
    return { status: "error", message: "Something went wrong unlocking the report." };
  }

  if (lead.resume_match_status === "READY") {
    return { status: "unlocked", report: lead.resume_match_raw as ResumeMatchReportReady };
  }

  let report;
  try {
    report = await getResumeMatchReport(lead.ib_applied_job_id);
  } catch {
    return { status: "error", message: "Unlocked, but the report failed to load — please refresh." };
  }

  if (report.status === "PENDING") {
    return { status: "pending" };
  }

  const resumeMatchRaw: ResumeMatchReportReady = {
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
    return { status: "error", message: "Unlocked, but the report failed to save — please refresh." };
  }

  return { status: "unlocked", report: resumeMatchRaw };
}
