import { redirect } from "next/navigation";
import { Download, ListChecks, ChartColumn, ShieldCheck, ShieldAlert, Clock, Activity } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import { getCandidateResumeDetails } from "@/lib/intervuebox/reports";
import { DEFAULT_LEVEL, type CandidateLevel } from "@/lib/razorpay/pricing";
import InterviewScoreGauge from "./InterviewScoreGauge";
import SkillDistribution from "./SkillDistribution";
import InterviewTabs from "./InterviewTabs";
import InterviewLockedState from "./InterviewLockedState";
import InterviewInProgressState from "./InterviewInProgressState";
import InterviewAppearedState from "./InterviewAppearedState";
import InterviewTerminatedState from "./InterviewTerminatedState";
import InterviewStuckState from "./InterviewStuckState";
import { resolveInterviewViewState } from "./resolveInterviewViewState";
import { isInterviewGenerating } from "../interviewProgress";
import InterviewGeneratingState from "./InterviewGeneratingState";
import ExportPreviewButton from "../ExportPreviewButton";

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";

function StatTile({ icon: Icon, value, label }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; value: string; label: string }) {
  return (
    <div className="flex items-center bg-white/[0.04]" style={{ gap: 10, borderRadius: 10, padding: "10px 12px" }}>
      <div className="flex items-center justify-center bg-[#ed1a24]/15 shrink-0" style={{ width: 30, height: 30, borderRadius: 8 }}>
        <Icon size={14} strokeWidth={2} className="text-[#ed1a24]" />
      </div>
      <div style={{ minWidth: 0 }}>
        <p className="font-[family-name:var(--font-gabarito)] font-bold text-white truncate" style={{ fontSize: 14, margin: 0 }}>
          {value}
        </p>
        <p className="font-[family-name:var(--font-poppins)] font-semibold uppercase text-white/40 truncate" style={{ fontSize: 9.5, letterSpacing: "0.04em", margin: 0 }}>
          {label}
        </p>
      </div>
    </div>
  );
}

export default async function InterviewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead: leadIdParam } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }
  const userId = user.id;

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, role_title, candidate_level")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!leads?.length) {
    redirect("/hub/account");
  }
  const activeLead = leadIdParam
    ? leads.find(l => l.id === leadIdParam) || leads[0]
    : leads[0];

  // Query interviews for the active lead
  const { data: interview } = await supabase
    .from("fitment_interviews")
    .select("role_title, status, report_raw, updated_at, ib_interview_status, stuck_at, invited_at, lead_id")
    .eq("user_id", userId)
    .eq("lead_id", activeLead.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const viewState = resolveInterviewViewState(interview);

  if (viewState === "locked") {
    const level = (activeLead.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;

    return (
      <main>
        <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>
              Mock AI interview
            </h1>
            <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, margin: 0 }}>
              Role-matched questions with a scored breakdown afterward.
            </p>
          </div>
          <InterviewLockedState leadId={activeLead.id} roleTitle={activeLead.role_title} level={level} userEmail={user.email ?? ""} />
        </div>
      </main>
    );
  }

  if (!interview) {
    // Unreachable -- resolveInterviewViewState only returns "locked" (handled
    // above) when interview is null. Narrows the type for everything below.
    redirect("/hub/account");
  }

  if (viewState === "invited") {
    const level = (activeLead.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;
    const generating = isInterviewGenerating("invited", interview.invited_at, level);

    return (
      <main>
        <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          {generating ? (
            <InterviewGeneratingState roleTitle={interview.role_title} />
          ) : (
            <InterviewInProgressState roleTitle={interview.role_title} leadId={activeLead.id} />
          )}
        </div>
      </main>
    );
  }

  if (viewState === "appeared") {
    return (
      <main>
        <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          <InterviewAppearedState roleTitle={interview.role_title} />
        </div>
      </main>
    );
  }

  if (viewState === "terminated") {
    return (
      <main>
        <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          <InterviewTerminatedState roleTitle={interview.role_title} leadId={interview.lead_id ?? ""} />
        </div>
      </main>
    );
  }

  if (viewState === "stuck") {
    return (
      <main>
        <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          <InterviewStuckState roleTitle={interview.role_title} />
        </div>
      </main>
    );
  }

  const report = interview.report_raw as InterviewReportReady;

  // Fetch additional lead details for the active lead
  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("name, ib_applied_job_id")
    .eq("user_id", user.id)
    .eq("id", activeLead.id)
    .maybeSingle();

  const candidateDetails = lead?.ib_applied_job_id
    ? await getCandidateResumeDetails(lead.ib_applied_job_id).catch((err) => {
        console.error("getCandidateResumeDetails failed, rendering interview report without organisation", err);
        return null;
      })
    : null;

  const organisation = candidateDetails?.experience[0]?.company ?? null;
  const location = candidateDetails?.location ?? null;
  const totalExperience = candidateDetails?.totalExperience ?? null;
  const phoneNumber = candidateDetails?.phoneNumber ?? null;

  const displayName = lead?.name || user.email || "Candidate";
  const formattedDate = new Date(interview.updated_at).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const infoBarParts = [
    organisation,
    totalExperience != null ? `${totalExperience} yrs experience` : null,
    location,
    phoneNumber,
    formattedDate,
    report.approxDurationMinutes != null ? `~${report.approxDurationMinutes} min` : null,
  ].filter((part): part is string => Boolean(part));

  // Note on the mockup's "Camera checks" stat tile and per-trait camera
  // scoring: report_raw (InterviewReportReady) carries confidenceLevel/
  // presentation/bodyLanguage/environmentCheck/responseQuality as freeform
  // strings (Practice conduct tab), not a discrete pass/fail per trait, plus
  // flagForSuspiciousActivity/integrityCheck/videoReport for the rest. tabChanges
  // is real and rendered above when present; none of these fields are ever
  // fabricated client-side -- they're null until IntervueBox actually sends them.
  const skillsAssessedCount = Object.keys(report.skillReport ?? {}).length;

  return (
    <main>
      <div className="mx-auto" style={{ maxWidth: 880, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="flex items-start justify-between flex-wrap" style={{ gap: 12 }}>
          <div>
            <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
              Mock AI interview
            </p>
            <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
              <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.7rem", margin: 0 }}>
                {displayName}
              </h1>
              <span
                className="bg-[#ed1a24] font-[family-name:var(--font-poppins)] font-semibold text-white"
                style={{ fontSize: 11.5, borderRadius: 50, padding: "4px 12px" }}
              >
                {interview.role_title}
              </span>
            </div>
            {report.interviewTitle && (
              <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12, margin: "6px 0 0" }}>
                {report.interviewTitle}
              </p>
            )}
            {infoBarParts.length > 0 && (
              <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                {infoBarParts.join(" · ")}
              </p>
            )}
          </div>
          <div className="print:hidden flex items-center flex-wrap shrink-0" style={{ gap: 8 }}>
            <ExportPreviewButton
              exportUrl={`/api/hub/interview/export?lead=${encodeURIComponent(activeLead.id)}`}
              title="Mock interview report"
            />
            <a
              href={`/api/hub/interview/export?lead=${encodeURIComponent(activeLead.id)}`}
              download
              className="flex items-center hover:bg-white/[0.06] transition-colors font-[family-name:var(--font-poppins)] font-medium text-white"
              style={{ gap: 6, fontSize: 12, borderRadius: 12, padding: "7px 12px", background: "rgb(21,18,22)", border: "1px solid rgb(49,47,55)" }}
            >
              <Download size={13} strokeWidth={2} /> Download
            </a>
          </div>
        </div>

        <div
          className="bg-[#141416] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center"
          style={{ borderRadius: 14, padding: 20, gap: 20 }}
        >
          <div className="shrink-0" style={{ margin: "0 auto" }}>
            <InterviewScoreGauge score={report.overallScore} />
          </div>
          <div className={`grid grid-cols-2 ${report.tabChanges != null ? "sm:grid-cols-5" : "sm:grid-cols-4"}`} style={{ flex: 1, minWidth: 0, gap: 10, width: "100%" }}>
            <StatTile icon={ListChecks} value={String(report.answers.length)} label="Questions" />
            <StatTile icon={ChartColumn} value={String(skillsAssessedCount)} label="Skills assessed" />
            {report.tabChanges != null && <StatTile icon={Activity} value={String(report.tabChanges)} label="Tab changes" />}
            <StatTile
              icon={report.flagForSuspiciousActivity ? ShieldAlert : ShieldCheck}
              value={report.flagForSuspiciousActivity ? "Flagged" : "All clear"}
              label="Integrity"
            />
            <StatTile icon={Clock} value={report.approxDurationMinutes != null ? `${report.approxDurationMinutes}m` : "-"} label="Duration" />
          </div>
        </div>

        {skillsAssessedCount > 0 && <SkillDistribution skillReport={report.skillReport} />}

        <InterviewTabs report={report} />

        {report.shareableReportLink && (
          <a
            href={report.shareableReportLink}
            target="_blank"
            rel="noreferrer"
            className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
            style={{ fontSize: 13 }}
          >
            View full report on IntervueBox →
          </a>
        )}
      </div>
    </main>
  );
}
