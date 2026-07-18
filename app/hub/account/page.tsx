import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";
import DashboardClient from "./DashboardClient";
import type { InterviewStatus } from "./ProgressRail";
import { getResumeMatchReport, scoreOutOfTen, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import { getSupabaseServerClient } from "@/lib/supabase";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, role_title, score, verdict, resume_match_status, resume_match_raw, ib_applied_job_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!leads || leads.length === 0) {
    return (
      <main style={{ padding: "48px 20px", maxWidth: 640, margin: "0 auto" }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem" }}>
          No fitment scores yet
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 14 }}>
          Head back to the HUB to check your fit for a role.
        </p>
      </main>
    );
  }

  const current = leads[0];
  const prevForSameRole = leads.find((l, i) => i > 0 && l.role_title === current.role_title);

  const reportUnlocked = await isReportUnlocked(user.id, current.role_title);

  let score = current.score;
  let verdict = current.verdict;
  let resumeMatchStatus = current.resume_match_status;
  let resumeMatchRaw = current.resume_match_raw;

  if (resumeMatchStatus === "PENDING") {
    try {
      const report = await getResumeMatchReport(current.ib_applied_job_id);
      if (report.status === "READY") {
        const freshRaw = {
          overallScore: report.overallScore,
          rank: report.rank,
          categories: report.categories,
          summary: report.summary,
          strongPoints: report.strongPoints,
          weakPoints: report.weakPoints,
        };
        const admin = getSupabaseServerClient();
        await admin
          .from("fitment_leads")
          .update({
            score: scoreOutOfTen(report.overallScore),
            verdict: report.summary,
            resume_match_status: "READY",
            resume_match_score: report.overallScore,
            resume_match_raw: freshRaw,
          })
          .eq("id", current.id);

        score = scoreOutOfTen(report.overallScore);
        verdict = report.summary;
        resumeMatchStatus = "READY";
        resumeMatchRaw = freshRaw;
      }
    } catch (err) {
      console.error("getResumeMatchReport failed on dashboard read, falling back to stale values", err);
    }
  }

  const report: ResumeMatchReportReady | null =
    reportUnlocked && resumeMatchStatus === "READY" && resumeMatchRaw
      ? (resumeMatchRaw as ResumeMatchReportReady)
      : null;

  const { data: interviewRow } = await supabase
    .from("fitment_interviews")
    .select("status")
    .eq("user_id", user.id)
    .eq("role_title", current.role_title)
    .maybeSingle();

  const interviewStatus: InterviewStatus = !interviewRow
    ? "not_started"
    : interviewRow.status === "ready"
      ? "ready"
      : "invited";

  const referenceCheck = await getReferenceCheckStatus(user.id);
  const referenceCheckStatus: "none" | "in_progress" | "completed" =
    !referenceCheck ? "none" : referenceCheck.status === "completed" ? "completed" : "in_progress";

  return (
    <DashboardClient
      roleTitle={current.role_title}
      score={score}
      prevScore={prevForSameRole ? prevForSameRole.score : null}
      verdict={verdict}
      initialReportUnlocked={reportUnlocked}
      initialReport={report}
      initialInterviewStatus={interviewStatus}
      referenceCheckStatus={referenceCheckStatus}
    />
  );
}
