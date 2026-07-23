import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import { getCandidateResumeDetails } from "@/lib/intervuebox/reports";
import InterviewScoreGauge from "./InterviewScoreGauge";
import ParameterScoreTile from "./ParameterScoreTile";

// report.strengths/areasOfImprovement arrive as a single "- point\n- point"
// string (IntervueBox's own format), not an array like the fitment report's
// strongPoints/weakPoints — split so both report pages render bullet lists
// the same way.
function splitBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
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

  const displayName = lead?.name || user.email || "Candidate";
  const formattedDate = new Date(interview.updated_at).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const infoBarParts = [
    organisation,
    formattedDate,
    report.approxDurationMinutes != null ? `~${report.approxDurationMinutes} min` : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "48px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 900 }}>
        <Link
          href="/hub/account"
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ fontSize: 13 }}
        >
          ← Back to dashboard
        </Link>

        <div className="flex items-center justify-between flex-wrap" style={{ margin: "14px 0 4px", gap: 12 }}>
          <div>
            <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
              <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.8rem", margin: 0 }}>
                {displayName}
              </h1>
              <span
                className="bg-[#ed1a24] font-[family-name:var(--font-poppins)] font-semibold text-white"
                style={{ fontSize: 11.5, borderRadius: 50, padding: "4px 12px" }}
              >
                {interview.role_title}
              </span>
            </div>
            {infoBarParts.length > 0 && (
              <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, margin: "8px 0 0" }}>
                {infoBarParts.join(" · ")}
              </p>
            )}
          </div>
          <Image src="/logo.png" alt="Merito" width={100} height={28} style={{ height: 24, width: "auto" }} />
        </div>

        <div
          className="bg-white border border-black/[0.08]"
          style={{
            borderRadius: 14,
            padding: 20,
            margin: "20px 0 32px",
            display: "grid",
            gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div>
            <p
              className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
              style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 12px" }}
            >
              Parameters score
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
              {Object.entries(report.skillMetrics).map(([skill, score]) => (
                <ParameterScoreTile key={skill} skill={skill} score={score} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center">
            <InterviewScoreGauge score={report.overallScore} />
          </div>
        </div>

        <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, margin: "0 0 32px" }}>
          <p
            className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
            style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}
          >
            AI overview
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>
            {report.overallSummary}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14 }}>
          {report.strengths && (
            // Green tint matches the dashboard's own "Top strengths" card
            // (design_handoff_merito_hub/dashboard/Merito HUB Dashboard.dc.html)
            // rather than a plain white/bordered card.
            <div className="bg-[#eefdf1]" style={{ borderRadius: 14, padding: "14px 16px" }}>
              <p
                className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#16803c]"
                style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}
              >
                Strengths
              </p>
              {splitBullets(report.strengths).map((point, i) => (
                <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.7, margin: "0 0 8px" }}>
                  ✓ {point}
                </p>
              ))}
            </div>
          )}

          {report.areasOfImprovement && (
            // Red tint matches the dashboard's own "Gaps costing you
            // shortlists" card in the same reference file.
            <div className="bg-[#fdeced]" style={{ borderRadius: 14, padding: "14px 16px" }}>
              <p
                className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]"
                style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}
              >
                Areas to improve
              </p>
              {splitBullets(report.areasOfImprovement).map((point, i) => (
                <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.7, margin: "0 0 8px" }}>
                  ✗ {point}
                </p>
              ))}
            </div>
          )}
        </div>

        {report.shareableReportLink && (
          <a
            href={report.shareableReportLink}
            target="_blank"
            rel="noreferrer"
            className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
            style={{ fontSize: 13, display: "inline-block", marginTop: 32 }}
          >
            View full report on IntervueBox →
          </a>
        )}
      </div>
    </main>
  );
}
