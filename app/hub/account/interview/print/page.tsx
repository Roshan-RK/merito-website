import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Manrope } from "next/font/google";
import { CheckCircle2, XCircle, ShieldCheck, ShieldAlert } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import { getCandidateResumeDetails } from "@/lib/intervuebox/reports";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope" });

export const metadata: Metadata = { title: "Mock interview" };

// Printable/PDF-export target for the mock interview report -- mirrors
// app/hub/account/report/print/page.tsx's pattern (light theme, single
// continuous page, screenshotted by app/api/hub/interview/export/route.tsx
// via headless Chromium).

function scoreTone(score: number): { label: string; background: string; color: string } {
  if (score >= 70) return { label: "Strong", background: "#DCFCE7", color: "#15803D" };
  if (score >= 40) return { label: "Developing", background: "#F1F5F9", color: "#475569" };
  return { label: "Needs work", background: "#FEE2E2", color: "#B91C1C" };
}

function skillTone(score: number): string {
  if (score >= 60) return "#15803D";
  if (score >= 45) return "#15803D";
  if (score >= 35) return "#92400E";
  return "#B91C1C";
}

function MeritoMark() {
  return <Image src="/logo.png" alt="Merito" width={128} height={36} style={{ height: 26, width: "auto" }} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="border" style={{ background: "#fff", borderColor: "#F1E3E5", borderRadius: 16, padding: 20, marginBottom: 16 }}>
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
  const tone = scoreTone(report.overallScore);
  const formattedDate = new Date(interview.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const skillEntries = Object.entries(report.skillReport ?? {}).sort((a, b) => b[1].score - a[1].score);

  return (
    <div className={`${manrope.variable} sm:p-8`} style={{ background: "#FBF3F4", color: "#111827", fontFamily: "var(--font-manrope), system-ui, sans-serif", minHeight: "100vh", padding: "24px" }}>
      <div className="flex items-start justify-between flex-wrap" style={{ gap: 12, marginBottom: 20 }}>
        <div>
          <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
            <h1 className="font-bold" style={{ fontSize: 24, margin: 0, color: "#111827" }}>
              {displayName}
            </h1>
            <span className="font-semibold text-white" style={{ fontSize: 12, borderRadius: 50, padding: "4px 12px", background: "#EC1B25" }}>
              {interview.role_title}
            </span>
          </div>
          <p style={{ fontSize: 14, margin: "4px 0 0", color: "#6B7280" }}>
            {formattedDate}
            {report.approxDurationMinutes != null ? ` · ~${report.approxDurationMinutes} min` : ""}
            {candidateDetails?.location ? ` · ${candidateDetails.location}` : ""}
          </p>
        </div>
        <MeritoMark />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between" style={{ gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px", color: "#9CA3AF" }}>
              Mock AI interview
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
              {[
                { label: "Questions", value: String(report.answers.length) },
                { label: "Skills assessed", value: String(skillEntries.length) },
                { label: "Integrity", value: report.flagForSuspiciousActivity ? "Flagged" : "All clear" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p style={{ fontSize: 12, margin: "0 0 3px", color: "#9CA3AF" }}>{stat.label}</p>
                  <p className="font-semibold" style={{ fontSize: 14, margin: 0, color: "#111827" }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-center" style={{ gap: 8 }}>
            <span className="font-semibold" style={{ fontSize: 12, borderRadius: 50, padding: "4px 12px", background: tone.background, color: tone.color }}>
              {tone.label}
            </span>
            <div className="relative" style={{ width: 96, height: 96 }}>
              <svg width={96} height={96} viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth={9} />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={tone.color}
                  strokeWidth={9}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - report.overallScore / 100)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold" style={{ fontSize: 20, color: "#111827" }}>
                  {Math.round(report.overallScore)}%
                </span>
              </div>
            </div>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Overall score</span>
          </div>
        </div>
      </Card>

      <Card>
        <p className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 8px", color: "#9CA3AF" }}>
          Summary
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: "#374151" }}>{report.overallSummary}</p>
      </Card>

      {skillEntries.length > 0 && (
        <>
          <h2 className="font-bold" style={{ fontSize: 18, margin: "0 0 10px", color: "#111827" }}>
            Skill scores
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 16 }}>
            {skillEntries.map(([skill, entry]) => {
              const color = skillTone(entry.score);
              return (
                <div key={skill} className="border" style={{ background: "#fff", borderColor: "#F1E3E5", borderRadius: 16, padding: 16, breakInside: "avoid" }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                    <span className="font-semibold" style={{ fontSize: 14, color: "#111827" }}>
                      {skill}
                    </span>
                    <span className="font-bold" style={{ fontSize: 14, color }}>
                      {Math.round(entry.score)}%
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 6, overflow: "hidden", marginBottom: 10, background: "#E5E7EB" }}>
                    <div style={{ height: "100%", borderRadius: 6, width: `${entry.score}%`, background: color }} />
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "#4B5563" }}>{entry.comment}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 16 }}>
        {report.strengths && (
          <div style={{ background: "#F0FDF4", borderRadius: 16, padding: 16 }}>
            <p className="font-semibold uppercase" style={{ fontSize: 12, letterSpacing: "0.06em", margin: "0 0 10px", color: "#15803D" }}>
              Strengths
            </p>
            <div className="flex items-start" style={{ gap: 8, fontSize: 13, lineHeight: 1.6, color: "#166534" }}>
              <CheckCircle2 size={14} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
              {report.strengths}
            </div>
          </div>
        )}
        {report.areasOfImprovement && (
          <div style={{ background: "#FEF2F2", borderRadius: 16, padding: 16 }}>
            <p className="font-semibold uppercase" style={{ fontSize: 12, letterSpacing: "0.06em", margin: "0 0 10px", color: "#B91C1C" }}>
              Areas of improvement
            </p>
            <div className="flex items-start" style={{ gap: 8, fontSize: 13, lineHeight: 1.6, color: "#991B1B" }}>
              <XCircle size={14} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
              {report.areasOfImprovement}
            </div>
          </div>
        )}
      </div>

      <Card>
        <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
          {report.flagForSuspiciousActivity ? (
            <ShieldAlert size={16} strokeWidth={2} style={{ color: "#B91C1C" }} />
          ) : (
            <ShieldCheck size={16} strokeWidth={2} style={{ color: "#6B7280" }} />
          )}
          <span className="font-bold" style={{ fontSize: 16, color: "#111827" }}>
            Integrity
          </span>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.65, margin: 0, color: "#4B5563" }}>
          {report.integrityCheck ?? (report.flagForSuspiciousActivity ? "Flagged for review." : "No issues detected during this interview.")}
        </p>
      </Card>

      {report.roadmap && (
        <Card>
          <p className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 8px", color: "#9CA3AF" }}>
            Roadmap
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: "#374151" }}>{report.roadmap}</p>
        </Card>
      )}
    </div>
  );
}
