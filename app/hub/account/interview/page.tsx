import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, HelpCircle, Sparkles, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import { getCandidateResumeDetails } from "@/lib/intervuebox/reports";
import InterviewScoreGauge from "./InterviewScoreGauge";
import SkillDistribution from "./SkillDistribution";
import InterviewTabs from "./InterviewTabs";

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
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { role } = await searchParams;
  const roleTitle = typeof role === "string" ? role : null;

  let query = supabase
    .from("fitment_interviews")
    .select("role_title, status, report_raw, updated_at")
    .eq("user_id", user.id);

  if (roleTitle) {
    query = query.eq("role_title", roleTitle);
  }

  const { data: interview } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!interview || interview.status !== "ready" || !interview.report_raw) {
    redirect("/hub/account");
  }

  const report = interview.report_raw as InterviewReportReady;

  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("name, ib_applied_job_id")
    .eq("user_id", user.id)
    .eq("role_title", interview.role_title)
    .order("created_at", { ascending: false })
    .limit(1)
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

  // Note on the mockup's "Tab changes" / "Camera checks" stat tiles and the
  // "Practice conduct" tab's dress-code/body-language/environment fields:
  // report_raw (InterviewReportReady) has no such discrete fields -- only a
  // flagForSuspiciousActivity boolean, a freeform integrityCheck string, and
  // a freeform videoReport narrative. This panel surfaces exactly those real
  // fields (as "Integrity" here, and in the Practice conduct tab) instead of
  // fabricating tab-change counts or per-trait camera scoring.
  const skillsAssessedCount = Object.keys(report.skillReport ?? {}).length;

  return (
    <main>
      <div className="mx-auto" style={{ maxWidth: 880, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="print:hidden flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
          <Link
            href="/hub/account"
            className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white/55 hover:text-white transition-colors"
            style={{ gap: 6, fontSize: 13 }}
          >
            <ArrowLeft size={14} strokeWidth={2} /> Back to dashboard
          </Link>
          <a
            href={`/api/hub/interview/export?role=${encodeURIComponent(interview.role_title)}`}
            download
            className="flex items-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ gap: 6, fontSize: 12.5, borderRadius: 50, padding: "7px 14px", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Download size={13} strokeWidth={2} /> Download PDF
          </a>
        </div>

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

        <div
          className="bg-[#141416] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center"
          style={{ borderRadius: 14, padding: 20, gap: 20 }}
        >
          <div className="shrink-0" style={{ margin: "0 auto" }}>
            <InterviewScoreGauge score={report.overallScore} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ flex: 1, minWidth: 0, gap: 10, width: "100%" }}>
            <StatTile icon={HelpCircle} value={String(report.answers.length)} label="Questions" />
            <StatTile icon={Sparkles} value={String(skillsAssessedCount)} label="Skills assessed" />
            <StatTile
              icon={report.flagForSuspiciousActivity ? ShieldAlert : ShieldCheck}
              value={report.flagForSuspiciousActivity ? "Flagged" : "All clear"}
              label="Integrity"
            />
            <StatTile icon={Clock} value={report.approxDurationMinutes != null ? `${report.approxDurationMinutes}m` : "—"} label="Duration" />
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
