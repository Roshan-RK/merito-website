import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";
import DashboardClient from "./DashboardClient";
import type { InterviewStatus, PersonalityStatus } from "./ProgressRail";
import { getResumeMatchReport, scoreOutOfTen, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import { getInterviewReport, getInterviewCandidateStatus, generateInterviewReport } from "@/lib/intervuebox/interviewReports";
import { getSupabaseServerClient } from "@/lib/supabase";
import { PRODUCT_PRICING, DEFAULT_LEVEL, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";
import { isProductUnlocked } from "@/lib/productUnlocks";
import { getRecruiterViewCount } from "@/lib/recruiterActivity";
import RecruiterActivityPanel from "./RecruiterActivityPanel";

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
    .select("id, role_title, name, score, verdict, resume_match_status, resume_match_raw, ib_applied_job_id, created_at, candidate_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!leads || leads.length === 0) {
    return (
      <main style={{ padding: "48px 20px", maxWidth: 640, margin: "0 auto" }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.6rem" }}>
          No fitment scores yet
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 14 }}>
          Head back to the HUB to check your fit for a role.
        </p>
        <Link
          href="/hub#fit-checker"
          className="inline-block font-[family-name:var(--font-poppins)] font-semibold text-white text-center"
          style={{ marginTop: 18, padding: "12px 22px", borderRadius: 8, fontSize: 14, background: "#ed1a24" }}
        >
          Check my fitment
        </Link>
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
        // IntervueBox can return a null summary on an otherwise-READY report
        // (live-confirmed) -- verdict is NOT NULL, so a bare pass-through
        // 500s this update even though the score itself is valid.
        const freshVerdict = report.summary || "No summary available.";
        const admin = getSupabaseServerClient();
        await admin
          .from("fitment_leads")
          .update({
            score: scoreOutOfTen(report.overallScore),
            verdict: freshVerdict,
            resume_match_status: "READY",
            resume_match_score: report.overallScore,
            resume_match_raw: freshRaw,
          })
          .eq("id", current.id);

        score = scoreOutOfTen(report.overallScore);
        verdict = freshVerdict;
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
    .select("id, status, ib_agent_id, ib_candidate_id, invited_at, report_generation_requested_at")
    .eq("user_id", user.id)
    .eq("role_title", current.role_title)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let interviewStatus: InterviewStatus = !interviewRow
    ? "not_started"
    : interviewRow.status === "ready"
      ? "ready"
      : "invited";

  // The DB row only flips to "ready" via IntervueBox's webhook -- if that
  // delivery is ever missed, nothing else updates it. Self-heal the same
  // way the resume-match report above does: re-check IntervueBox directly
  // whenever we're about to show a stale "invited" (processing) state.
  if (interviewRow && interviewStatus === "invited") {
    try {
      const interviewReport = await getInterviewReport(interviewRow.ib_agent_id, interviewRow.ib_candidate_id);
      if (interviewReport.status === "READY") {
        const admin = getSupabaseServerClient();
        await admin
          .from("fitment_interviews")
          .update({
            status: "ready",
            report_raw: {
              overallScore: interviewReport.overallScore,
              skillMetrics: interviewReport.skillMetrics,
              overallSummary: interviewReport.overallSummary,
              strengths: interviewReport.strengths,
              areasOfImprovement: interviewReport.areasOfImprovement,
              shareableReportLink: interviewReport.shareableReportLink,
              approxDurationMinutes: interviewReport.approxDurationMinutes,
              flagForSuspiciousActivity: interviewReport.flagForSuspiciousActivity,
              integrityCheck: interviewReport.integrityCheck,
              videoReport: interviewReport.videoReport,
              feedbackToInterviewer: interviewReport.feedbackToInterviewer,
              roadmap: interviewReport.roadmap,
              criteriaEvaluationTable: interviewReport.criteriaEvaluationTable,
              interviewTitle: interviewReport.interviewTitle,
              skillReport: interviewReport.skillReport,
              overallSkillScore: interviewReport.overallSkillScore,
              answers: interviewReport.answers,
              knowledgeAnswers: interviewReport.knowledgeAnswers,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", interviewRow.id);
        interviewStatus = "ready";
      } else if (!interviewRow.report_generation_requested_at) {
        // IntervueBox only auto-evaluates outcomes reached normally --
        // TERMINATED never gets a report unless generation is explicitly
        // requested (vendor-confirmed, Krupal 2026-08-10). Ask for it once;
        // the generated report still surfaces later via this same self-heal
        // read (or the webhook), same as a normal completion.
        const candidateStatus = await getInterviewCandidateStatus(interviewRow.ib_agent_id, interviewRow.ib_candidate_id);
        if (candidateStatus === "TERMINATED") {
          await generateInterviewReport(interviewRow.ib_agent_id, [interviewRow.ib_candidate_id]);
          const admin = getSupabaseServerClient();
          await admin
            .from("fitment_interviews")
            .update({ report_generation_requested_at: new Date().toISOString() })
            .eq("id", interviewRow.id);
        }
      }
    } catch (err) {
      console.error("Interview self-heal check failed, leaving status as invited", err);
    }
  }

  const referenceCheck = await getReferenceCheckStatus(user.id);
  const referenceCheckStatus: "none" | "in_progress" | "completed" =
    !referenceCheck ? "none" : referenceCheck.status === "completed" ? "completed" : "in_progress";

  const { data: personalityRow } = await supabase
    .from("personality_tests")
    .select("role_title")
    .eq("user_id", user.id)
    .eq("role_title", current.role_title)
    .maybeSingle();

  const personalityStatus: PersonalityStatus = personalityRow ? "ready" : "not_started";

  const level = (current.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;
  const counsellingPriceLabel = formatPrice(PRODUCT_PRICING.counselling[level]);

  const [personalityUnlocked, referencesUnlocked] = await Promise.all([
    isProductUnlocked(user.id, "personality"),
    isProductUnlocked(user.id, "references"),
  ]);
  const bundleEligible = !personalityUnlocked && !referencesUnlocked;

  const { data: counsellingRequest } = await supabase
    .from("counselling_requests")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const recruiterViewCount = await getRecruiterViewCount(user.id);
  const userName = current.name || user.email?.split("@")[0] || "there";

  return (
    <DashboardClient
      leadId={current.id}
      roleTitle={current.role_title}
      level={level}
      bundleEligible={bundleEligible}
      personalityUnlocked={personalityUnlocked}
      referencesUnlocked={referencesUnlocked}
      userEmail={user.email ?? ""}
      userName={userName}
      score={score}
      prevScore={prevForSameRole ? prevForSameRole.score : null}
      verdict={verdict}
      initialReportUnlocked={reportUnlocked}
      initialReport={report}
      initialInterviewStatus={interviewStatus}
      interviewInvitedAt={interviewRow?.invited_at ?? null}
      referenceCheckStatus={referenceCheckStatus}
      personalityStatus={personalityStatus}
      counsellingPriceLabel={counsellingPriceLabel}
      initialCounsellingRequested={Boolean(counsellingRequest)}
      applications={leads.map((l) => ({ id: l.id, roleTitle: l.role_title, score: l.score, createdAt: l.created_at }))}
      recruiterActivity={<RecruiterActivityPanel viewCount={recruiterViewCount} />}
    />
  );
}
