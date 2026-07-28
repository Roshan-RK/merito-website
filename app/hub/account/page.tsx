import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";
import DashboardClient from "./DashboardClient";
import type { InterviewStatus, PersonalityStatus } from "./ProgressRail";
import { getResumeMatchReport, scoreOutOfTen, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import { getSupabaseServerClient } from "@/lib/supabase";
import { PRODUCT_PRICING, DEFAULT_LEVEL, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";
import { isProductUnlocked } from "@/lib/productUnlocks";

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
    .select("id, role_title, score, verdict, resume_match_status, resume_match_raw, ib_applied_job_id, created_at, candidate_level")
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
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const interviewStatus: InterviewStatus = !interviewRow
    ? "not_started"
    : interviewRow.status === "ready"
      ? "ready"
      : "invited";

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

  return (
    <DashboardClient
      leadId={current.id}
      roleTitle={current.role_title}
      level={level}
      bundleEligible={bundleEligible}
      personalityUnlocked={personalityUnlocked}
      referencesUnlocked={referencesUnlocked}
      score={score}
      prevScore={prevForSameRole ? prevForSameRole.score : null}
      verdict={verdict}
      initialReportUnlocked={reportUnlocked}
      initialReport={report}
      initialInterviewStatus={interviewStatus}
      referenceCheckStatus={referenceCheckStatus}
      personalityStatus={personalityStatus}
      counsellingPriceLabel={counsellingPriceLabel}
      initialCounsellingRequested={Boolean(counsellingRequest)}
    />
  );
}
