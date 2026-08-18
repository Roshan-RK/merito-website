import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Manrope } from "next/font/google";
import { Phone, Mail, MapPin, Sparkles, ShieldCheck, ShieldAlert, ListChecks, ThumbsUp, TrendingDown, Compass, CheckCircle2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import { getCandidateResumeDetails } from "@/lib/intervuebox/reports";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope" });

export const metadata: Metadata = { title: "Mock interview" };

// Printable/PDF-export target for the mock interview report. Rebuilt to
// mirror the mockup's dedicated `cF` PDF template (mockups/merito-dashboard-v34.html)
// rather than the generic fitment-report-style layout the first pass used --
// see app/api/hub/interview/export/route.tsx for the headless-Chromium caller.
//
// cF's own mockup data includes fields with no real backing source in our
// system (current/expected salary, expected joining date, interview
// language, and a fabricated multi-milestone "Candidate roadmap" timeline
// with per-milestone goals/resources). Those are intentionally omitted
// rather than invented -- every stat/section below maps to a real field.

const TIER_COLORS: Record<string, { bg: string; fg: string }> = {
  Exceptional: { bg: "#DCFCE7", fg: "#15803D" },
  Proficient: { bg: "#DCFCE7", fg: "#15803D" },
  Good: { bg: "#FEF3C7", fg: "#92400E" },
  Unsatisfactory: { bg: "#FEE2E2", fg: "#B91C1C" },
  Poor: { bg: "#FEE2E2", fg: "#B91C1C" },
};
const TIER_ORDER = ["Exceptional", "Proficient", "Good", "Unsatisfactory", "Poor"] as const;

function tierFor(score: number): (typeof TIER_ORDER)[number] {
  if (score >= 60) return "Exceptional";
  if (score >= 45) return "Proficient";
  if (score >= 35) return "Good";
  if (score >= 15) return "Unsatisfactory";
  return "Poor";
}

function paramColor(score: number): string {
  if (score >= 45) return "#16A34A";
  if (score >= 35) return "#D97706";
  return "#DC2626";
}

function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function MeritoMark() {
  return <Image src="/logo.png" alt="Merito" width={128} height={36} style={{ height: 24, width: "auto" }} />;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="border" style={{ background: "#fff", borderColor: "#F0E4C8", borderRadius: 16, padding: 20, marginBottom: 16, breakInside: "avoid" }}>
      {children}
    </div>
  );
}

function SectionHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center font-bold" style={{ gap: 8, marginBottom: 12, fontSize: 14, color: "#111827" }}>
      {icon}
      {children}
    </div>
  );
}

export default async function InterviewPrintPage({
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

  const { data: interview } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();

  if (!interview || interview.status !== "ready" || !interview.report_raw) {
    redirect("/hub/account/interview");
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
    ? await getCandidateResumeDetails(lead.ib_applied_job_id).catch(() => null)
    : null;

  const displayName = lead?.name || "Candidate";
  const currentOrganisation = candidateDetails?.experience?.[0]?.company ?? null;
  const formattedDate = new Date(interview.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // Natural declaration order, not sorted -- mirrors the mockup's own
  // divide-y skill list, which isn't score-sorted either.
  const skillEntries = Object.entries(report.skillReport ?? {});
  const isCriteriaMatchMode = typeof report.skillMetrics?.criteriaMatch === "number";
  const parameterEntries = isCriteriaMatchMode ? [] : Object.entries(report.skillMetrics ?? {});

  const tierCounts = TIER_ORDER.map((label) => ({
    label,
    count: skillEntries.filter(([, entry]) => entry.score != null && tierFor(entry.score) === label).length,
  }));

  const infoStats = [
    candidateDetails?.totalExperience != null
      ? { label: "Total work experience", value: `${candidateDetails.totalExperience} year${candidateDetails.totalExperience === 1 ? "" : "s"}` }
      : null,
    currentOrganisation ? { label: "Current organisation", value: currentOrganisation } : null,
    { label: "Interview date", value: formattedDate },
    report.approxDurationMinutes != null ? { label: "Interview duration", value: `${report.approxDurationMinutes} min` } : null,
    { label: "Overall score", value: `${Math.round(report.overallScore)}%` },
  ].filter((stat): stat is { label: string; value: string } => stat !== null);

  const conductFlagged = report.flagForSuspiciousActivity;
  const conductDetails = report.integrityCheck ?? (conductFlagged ? "Flagged for review." : "No issues detected during this interview.");

  return (
    <div
      className={`${manrope.variable} p-6 sm:p-8`}
      style={{ background: "#FFFBF0", color: "#111827", fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      <div className="mb-5 flex items-start justify-between flex-wrap" style={{ gap: 12 }}>
        <div>
          <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
            <h1 className="font-bold" style={{ fontSize: 24, margin: 0, color: "#111827" }}>
              {displayName}
            </h1>
            <span className="font-semibold text-white" style={{ fontSize: 12, borderRadius: 50, padding: "4px 12px", background: "#EC1B25" }}>
              {interview.role_title}
            </span>
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: 16, marginTop: 8, fontSize: 13, color: "#374151" }}>
            {candidateDetails?.phoneNumber && (
              <span className="flex items-center" style={{ gap: 6 }}>
                <Phone size={13} style={{ color: "#9CA3AF" }} />
                {candidateDetails.phoneNumber}
              </span>
            )}
            {user.email && (
              <span className="flex items-center" style={{ gap: 6 }}>
                <Mail size={13} style={{ color: "#9CA3AF" }} />
                {user.email}
              </span>
            )}
            {candidateDetails?.location && (
              <span className="flex items-center" style={{ gap: 6 }}>
                <MapPin size={13} style={{ color: "#9CA3AF" }} />
                {candidateDetails.location}
              </span>
            )}
          </div>
        </div>
        <MeritoMark />
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 border" style={{ gap: 16, background: "#fff", borderColor: "#F0E4C8", borderRadius: 16, padding: 20 }}>
        {infoStats.map((stat) => (
          <div key={stat.label}>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>{stat.label}</div>
            <div className="font-semibold" style={{ fontSize: 14, color: "#111827" }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
        {parameterEntries.length > 0 && (
          <SectionCard>
            <SectionHeading icon={null}>Parameters score</SectionHeading>
            <div className="grid grid-cols-2" style={{ gap: 12 }}>
              {parameterEntries.map(([skill, score]) => (
                <div key={skill} className="rounded-lg" style={{ background: "#F9FAFB", padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{titleCase(skill)}</div>
                  <div className="font-bold" style={{ fontSize: 18, color: paramColor(score) }}>
                    {Math.round(score)}%
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {report.overallSkillScore != null && (
          <SectionCard>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <span className="font-bold" style={{ fontSize: 14, color: "#111827" }}>
                Overall skill score
              </span>
              <span
                className="font-bold uppercase"
                style={{ fontSize: 11, borderRadius: 50, padding: "4px 10px", background: TIER_COLORS[tierFor(report.overallSkillScore)].bg, color: TIER_COLORS[tierFor(report.overallSkillScore)].fg }}
              >
                {tierFor(report.overallSkillScore)}
              </span>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative" style={{ height: 96, width: 96 }}>
                <svg viewBox="0 0 100 100" className="h-full w-full" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#F3F4F6" strokeWidth={9} />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={TIER_COLORS[tierFor(report.overallSkillScore)].fg}
                    strokeWidth={9}
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - report.overallSkillScore / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold" style={{ fontSize: 20 }}>
                  {Math.round(report.overallSkillScore)}%
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-1 text-center">
              {tierCounts.map((tier) => (
                <div key={tier.label}>
                  <div className="font-bold" style={{ fontSize: 16, color: TIER_COLORS[tier.label].fg }}>
                    {tier.count}
                  </div>
                  <div className="leading-tight" style={{ fontSize: 9, color: "#9CA3AF" }}>
                    {tier.label}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      <SectionCard>
        <SectionHeading icon={<Sparkles size={16} style={{ color: "#D97706" }} />}>AI overview</SectionHeading>
        <p style={{ fontSize: 13, lineHeight: 1.65, margin: 0, color: "#374151" }}>{report.overallSummary}</p>
      </SectionCard>

      <SectionCard>
        <SectionHeading icon={conductFlagged ? <ShieldAlert size={16} style={{ color: "#D97706" }} /> : <ShieldCheck size={16} style={{ color: "#D97706" }} />}>Practice conduct</SectionHeading>
        <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>Overall</span>
          <span
            className="font-semibold"
            style={{ fontSize: 12, borderRadius: 50, padding: "2px 10px", background: conductFlagged ? "#FEE2E2" : "#DCFCE7", color: conductFlagged ? "#B91C1C" : "#15803D" }}
          >
            {conductFlagged ? "Flagged" : "All clear"}
          </span>
        </div>
        <p className="border-t" style={{ paddingTop: 10, fontSize: 13, lineHeight: 1.65, margin: 0, color: "#374151", borderColor: "#F0E4C8" }}>
          {conductDetails}
        </p>
      </SectionCard>

      {skillEntries.length > 0 && (
        <SectionCard>
          <SectionHeading icon={<ListChecks size={16} style={{ color: "#D97706" }} />}>Skill-wise evaluation</SectionHeading>
          <div className="divide-y" style={{ borderColor: "#F0E4C8" }}>
            {skillEntries.map(([skill, entry]) => (
              <div key={skill} className="flex items-start justify-between" style={{ gap: 16, padding: "12px 0" }}>
                <div className="shrink-0 font-semibold" style={{ width: 128, fontSize: 13, color: "#111827" }}>
                  {skill}
                </div>
                <p className="flex-1" style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "#4B5563" }}>
                  {entry.comment}
                </p>
                <div className="shrink-0 text-right">
                  {entry.score == null ? (
                    <span className="rounded font-semibold" style={{ fontSize: 11, padding: "4px 8px", background: "#F3F4F6", color: "#9CA3AF" }}>
                      NA
                    </span>
                  ) : (
                    <>
                      <div className="rounded font-bold text-white" style={{ fontSize: 13, padding: "4px 8px", background: TIER_COLORS[tierFor(entry.score)].fg }}>
                        {entry.score}
                      </div>
                      <div className="mt-1 font-medium" style={{ fontSize: 10, color: TIER_COLORS[tierFor(entry.score)].fg }}>
                        {tierFor(entry.score)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
        {report.strengths && (
          <SectionCard>
            <SectionHeading icon={<ThumbsUp size={16} style={{ color: "#D97706" }} />}>Strengths</SectionHeading>
            <div className="flex items-start" style={{ gap: 8, fontSize: 13, lineHeight: 1.6, color: "#374151" }}>
              <CheckCircle2 size={14} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0, color: "#16A34A" }} />
              {report.strengths}
            </div>
          </SectionCard>
        )}
        {report.areasOfImprovement && (
          <SectionCard>
            <SectionHeading icon={<TrendingDown size={16} style={{ color: "#D97706" }} />}>Areas of improvement</SectionHeading>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "#374151" }}>{report.areasOfImprovement}</p>
          </SectionCard>
        )}
      </div>

      {report.roadmap && (
        <SectionCard>
          <SectionHeading icon={<Compass size={16} style={{ color: "#D97706" }} />}>Roadmap</SectionHeading>
          <p style={{ fontSize: 13, lineHeight: 1.65, margin: 0, color: "#374151" }}>{report.roadmap}</p>
        </SectionCard>
      )}
    </div>
  );
}
