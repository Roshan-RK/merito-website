import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { loadCombinedReportData } from "@/lib/combinedReportData";
import { getMatchBand } from "../../report/ResumeMatchGauge";
import { getScoreBand } from "../../interview/InterviewScoreGauge";
import { remapBand, remapBandDark } from "../combinedBandColors";
import CombinedGauge from "../CombinedGauge";
import CombinedCategoryCard from "../CombinedCategoryCard";
import CombinedCriteriaCard from "../CombinedCriteriaCard";
import CombinedSkillTable from "../CombinedSkillTable";
import CombinedRoadmapTimeline from "../CombinedRoadmapTimeline";
import CondensedPersonalitySection from "../CondensedPersonalitySection";
import { InlineText } from "../../EvaluatorNotes";
import { parseEvaluatorNotes } from "@/lib/intervuebox/markdownNotes";
import { getCriteriaStatusColor } from "@/lib/criteriaStatus";

// This route is the printable/PDF-export target for the consolidated
// report: app/api/hub/export/combined/route.tsx screenshots this exact URL
// via headless Chromium (renderPageToPdf, singlePage mode) to produce the
// downloadable PDF, and the "Preview" action on the dashboard summary panel
// (../page.tsx) opens it directly. It deliberately keeps the light,
// print-friendly "document" theme the public /hub/share/[token] page also
// uses, rather than the dashboard's dark theme -- a shareable/downloadable
// report should look like a neutral document, not the candidate's own
// themed dashboard. It was split out of ../page.tsx (which now hosts the
// dark, mockup-matching summary panel instead) with no change to the
// rendered output or data-fetching logic.

const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-fraunces" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter" });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-ibm-plex-mono" });

function splitBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function SectionHeading({ index, title, blurb, eyebrowColor = "#DE3A2C" }: { index: string; title: string; blurb: string; eyebrowColor?: string }) {
  return (
    <div style={{ margin: "48px 0 24px" }}>
      <p className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold uppercase" style={{ fontSize: 11.5, letterSpacing: "0.1em", margin: "0 0 10px", color: eyebrowColor }}>
        {index}
      </p>
      <h2 className="font-[family-name:var(--font-fraunces)] font-semibold text-black" style={{ fontSize: "1.9rem", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 14.5, margin: 0, maxWidth: "60ch", lineHeight: 1.6 }}>
        {blurb}
      </p>
    </div>
  );
}

function SummaryRow({ pillLabel, pillTier, children, gauge }: { pillLabel: string; pillTier: "strong" | "mid" | "weak"; children: React.ReactNode; gauge: React.ReactNode }) {
  const pillColors = {
    strong: { color: "#1E8F5E", background: "#E7F5EE" },
    mid: { color: "#BD7E12", background: "#FBF1DF" },
    weak: { color: "#95324B", background: "#F6E7EB" },
  }[pillTier];

  return (
    <div
      className="bg-white border border-black/[0.08]"
      style={{ borderRadius: 22, padding: "26px 30px", display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "center", marginBottom: 28, breakInside: "avoid" }}
    >
      <div>
        <span
          className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold uppercase"
          style={{ fontSize: 11, letterSpacing: "0.06em", padding: "5px 12px", borderRadius: 20, ...pillColors, display: "inline-block", marginBottom: 12 }}
        >
          {pillLabel}
        </span>
        <p className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 15, lineHeight: 1.65, margin: 0 }}>
          {children}
        </p>
      </div>
      {gauge}
    </div>
  );
}

function DimensionBars({ title, rows }: { title: string; rows: { label: string; value: number; max: number; color: string }[] }) {
  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 22, padding: "26px 30px", marginBottom: 22, breakInside: "avoid" }}>
      <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 11, letterSpacing: "0.1em", margin: "0 0 20px" }}>
        {title}
      </p>
      {rows.map((row) => (
        <div key={row.label} style={{ marginBottom: 16 }}>
          <div className="flex justify-between" style={{ fontSize: 13.5, marginBottom: 6 }}>
            <span className="font-[family-name:var(--font-inter)] font-medium text-black">{row.label}</span>
            <span className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold text-black">
              {row.max === 5 ? row.value.toFixed(1) : `${row.value}%`}
            </span>
          </div>
          <div style={{ height: 8, background: "#F4F1F7", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 6, width: `${(row.value / row.max) * 100}%`, background: row.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function heroPillTint(tier: "strong" | "mid" | "weak"): { background: string; color: string } {
  if (tier === "strong") return { background: "rgba(63,203,140,0.18)", color: "#7EE6B6" };
  if (tier === "mid") return { background: "rgba(189,126,18,0.18)", color: "#F0C674" };
  return { background: "rgba(232,121,143,0.18)", color: "#F2A6B6" };
}

function referenceBand(avg: number): { textColor: string; trackColor: string } {
  if (avg >= 4) return { textColor: "#1E8F5E", trackColor: "#E7F5EE" };
  if (avg >= 3) return { textColor: "#BD7E12", trackColor: "#FBF1DF" };
  return { textColor: "#95324B", trackColor: "#F6E7EB" };
}

export default async function CombinedReportPrintPage({
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

  const params = await searchParams;
  const includeParam = typeof params.include === "string" ? params.include : "fitment,personality,interview,references";
  const include = new Set(includeParam.split(",").filter(Boolean));
  const roleTitleParam = typeof params.role === "string" ? params.role : null;
  const DEFAULT_INTERVIEW_SECTIONS =
    "scoreGauge,overview,skillReport,criteriaMatch,skillEvaluation,strengths,integrity,roadmap";
  const interviewSectionsParam = typeof params.interviewSections === "string" ? params.interviewSections : DEFAULT_INTERVIEW_SECTIONS;
  const interviewSections = new Set(interviewSectionsParam.split(",").filter(Boolean));

  const { fitment, personality, interview, references, displayName, primaryRole } = await loadCombinedReportData({
    supabase,
    userId: user.id,
    userEmail: user.email,
    include,
    roleTitleParam,
  });

  if (!fitment && !personality && !interview && !references) {
    redirect("/hub/account");
  }

  const reportDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  const reportId = `MH-${user.id.split("-")[0].toUpperCase()}`;
  const sortedFitmentCategories = fitment ? [...fitment.report.categories].sort((a, b) => b.score - a.score) : [];
  const interviewRecommendation = interview?.report.feedbackToInterviewer
    ? parseEvaluatorNotes(interview.report.feedbackToInterviewer)?.recommendation ?? null
    : null;

  const sections: { key: string; label: string; blurb: string }[] = [];
  if (fitment) sections.push({ key: "fitment", label: "Role Fitment Analysis", blurb: "CV matched against the job description across six dimensions" });
  if (personality) sections.push({ key: "personality", label: "Personality Profile", blurb: "Big Five (OCEAN) traits and what each means at work" });
  if (interview) sections.push({ key: "interview", label: "AI Video Interview", blurb: "Skill-wise scoring, interview parameters and integrity check" });
  if (references) sections.push({ key: "references", label: "Reference Check", blurb: `Seven categories rated by ${references.referees.length} verified former colleague${references.referees.length === 1 ? "" : "s"}` });

  const fitmentBand = fitment ? remapBand(getMatchBand(fitment.report.overallScore)) : null;
  const interviewBand = interview ? remapBand(getScoreBand(interview.report.overallScore)) : null;
  const fitmentBandDark = fitment ? remapBandDark(getMatchBand(fitment.report.overallScore)) : null;
  const interviewBandDark = interview ? remapBandDark(getScoreBand(interview.report.overallScore)) : null;
  const refBand = references ? referenceBand(references.overallScore) : null;

  return (
    <main
      className={`${fraunces.variable} ${inter.variable} ${ibmPlexMono.variable}`}
      style={{ background: "#F4F1F7", minHeight: "100vh" }}
    >
      <div className="print:hidden" style={{ padding: "16px 20px 0" }}>
        <Link href="/hub/account/combined-report" className="font-[family-name:var(--font-inter)] font-semibold text-[#DE3A2C]" style={{ fontSize: 13 }}>
          ← Back to consolidated report
        </Link>
      </div>

      <div style={{ background: "radial-gradient(120% 140% at 15% 0%, #201B30 0%, #15121F 55%)", padding: "44px 20px 40px" }}>
        <div className="mx-auto" style={{ maxWidth: 860 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 34 }}>
            <Image src="/logo.png" alt="Merito" width={100} height={28} style={{ height: 24, width: "auto" }} />
            <p className="font-[family-name:var(--font-ibm-plex-mono)] text-[#B8B3C8]" style={{ fontSize: 11, letterSpacing: "0.06em", textAlign: "right", lineHeight: 1.6, margin: 0 }}>
              REPORT {reportId}
              <br />
              {reportDate.toUpperCase()}
            </p>
          </div>

          <p className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold uppercase text-[#DE3A2C]" style={{ fontSize: 11.5, letterSpacing: "0.12em", margin: "0 0 14px" }}>
            Candidate Credential Report
          </p>
          <h1 className="font-[family-name:var(--font-fraunces)] font-semibold text-white" style={{ fontSize: "clamp(2.3rem,6vw,3.5rem)", lineHeight: 1.02, margin: "0 0 14px", letterSpacing: "-0.01em" }}>
            {displayName}
          </h1>
          <p style={{ fontSize: 17, color: "#D9D5E6", margin: "0 0 14px" }} className="font-[family-name:var(--font-inter)]">
            Assessed for <strong style={{ color: "#fff", fontWeight: 600 }}>{primaryRole}</strong>
          </p>
          <p className="font-[family-name:var(--font-inter)]" style={{ maxWidth: "56ch", color: "#B8B3C8", fontSize: 14.5, lineHeight: 1.65, margin: "0 0 36px" }}>
            Four independent assessments — role fitment, personality, a proctored AI interview and peer references — consolidated by Merito HUB into one verifiable, shareable profile.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
            {fitment && fitmentBand && fitmentBandDark && (
              <div className="bg-white/[0.04] border border-white/[0.1]" style={{ borderRadius: 16, padding: "18px 14px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
                <CombinedGauge value={fitment.report.overallScore} max={100} displayValue={`${Math.round(fitment.report.overallScore)}%`} diameter={96} band={fitmentBandDark} numberColor="#fff" />
                <span className="font-[family-name:var(--font-inter)] font-semibold text-white" style={{ fontSize: 12.5 }}>Role Fitment</span>
                <span
                  className="font-[family-name:var(--font-ibm-plex-mono)] uppercase"
                  style={{ fontSize: 10, letterSpacing: "0.06em", padding: "3px 9px", borderRadius: 20, ...heroPillTint(fitment.report.overallScore >= 80 ? "strong" : fitment.report.overallScore >= 50 ? "mid" : "weak") }}
                >
                  {fitmentBand.label}
                </span>
              </div>
            )}
            {interview && interviewBand && interviewBandDark && (
              <div className="bg-white/[0.04] border border-white/[0.1]" style={{ borderRadius: 16, padding: "18px 14px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
                <CombinedGauge value={interview.report.overallScore} max={100} displayValue={`${Math.round(interview.report.overallScore)}%`} diameter={96} band={interviewBandDark} numberColor="#fff" />
                <span className="font-[family-name:var(--font-inter)] font-semibold text-white" style={{ fontSize: 12.5 }}>AI Interview</span>
                <span
                  className="font-[family-name:var(--font-ibm-plex-mono)] uppercase"
                  style={{ fontSize: 10, letterSpacing: "0.06em", padding: "3px 9px", borderRadius: 20, ...heroPillTint(interview.report.overallScore >= 70 ? "strong" : interview.report.overallScore >= 40 ? "mid" : "weak") }}
                >
                  {interviewBand.label}
                </span>
              </div>
            )}
            {references && refBand && (
              <div className="bg-white/[0.04] border border-white/[0.1]" style={{ borderRadius: 16, padding: "18px 14px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
                <CombinedGauge value={references.overallScore} max={5} displayValue={references.overallScore.toFixed(1)} diameter={96} band={{ textColor: refBand.textColor === "#1E8F5E" ? "#3FCB8C" : refBand.textColor === "#95324B" ? "#E8798F" : "#BD7E12", trackColor: "rgba(255,255,255,0.12)" }} numberColor="#fff" />
                <span className="font-[family-name:var(--font-inter)] font-semibold text-white" style={{ fontSize: 12.5 }}>References</span>
                <span
                  className="font-[family-name:var(--font-ibm-plex-mono)] uppercase"
                  style={{ fontSize: 10, letterSpacing: "0.06em", padding: "3px 9px", borderRadius: 20, ...heroPillTint(references.overallScore >= 4 ? "strong" : references.overallScore >= 3 ? "mid" : "weak") }}
                >
                  {references.referees.length} verified
                </span>
              </div>
            )}
            {personality && (
              <div className="bg-white/[0.04] border border-white/[0.1]" style={{ borderRadius: 16, padding: "18px 14px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
                <CombinedGauge value={5} max={5} displayValue="5/5" diameter={96} band={{ textColor: "#9C97E8", trackColor: "rgba(255,255,255,0.12)" }} numberColor="#fff" />
                <span className="font-[family-name:var(--font-inter)] font-semibold text-white" style={{ fontSize: 12.5 }}>Personality</span>
                <span
                  className="font-[family-name:var(--font-ibm-plex-mono)] uppercase"
                  style={{ fontSize: 10, letterSpacing: "0.06em", padding: "3px 9px", borderRadius: 20, background: "rgba(156,151,232,0.18)", color: "#C6C2F5" }}
                >
                  Traits mapped
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap" style={{ gap: 18, paddingTop: 20, marginTop: 22, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <span className="flex items-center font-[family-name:var(--font-ibm-plex-mono)] text-[#B8B3C8]" style={{ gap: 7, fontSize: 10.5, letterSpacing: "0.04em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3FCB8C" }} />
              Strong signal
            </span>
            <span className="flex items-center font-[family-name:var(--font-ibm-plex-mono)] text-[#B8B3C8]" style={{ gap: 7, fontSize: 10.5, letterSpacing: "0.04em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E0A83F" }} />
              Moderate
            </span>
            <span className="flex items-center font-[family-name:var(--font-ibm-plex-mono)] text-[#B8B3C8]" style={{ gap: 7, fontSize: 10.5, letterSpacing: "0.04em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8798F" }} />
              Needs development
            </span>
            <span className="flex items-center font-[family-name:var(--font-ibm-plex-mono)] text-[#B8B3C8]" style={{ gap: 7, fontSize: 10.5, letterSpacing: "0.04em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9C97E8" }} />
              Descriptive, not scored
            </span>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: "1px solid #E6E1ED" }}>
        <div className="mx-auto" style={{ maxWidth: 860, padding: "26px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 24 }}>
            <div>
              <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>Candidate</p>
              <p className="font-[family-name:var(--font-fraunces)] font-semibold text-black" style={{ fontSize: 17, margin: 0 }}>{displayName}</p>
            </div>
            <div>
              <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>Target Role</p>
              <p className="font-[family-name:var(--font-fraunces)] font-semibold text-black" style={{ fontSize: 17, margin: 0 }}>{primaryRole}</p>
            </div>
            <div>
              <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>Report Date</p>
              <p className="font-[family-name:var(--font-fraunces)] font-semibold text-black" style={{ fontSize: 17, margin: 0 }}>{reportDate}</p>
            </div>
            <div>
              <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>Report ID</p>
              <p className="font-[family-name:var(--font-fraunces)] font-semibold text-black" style={{ fontSize: 17, margin: 0 }}>{reportId}</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: "1px solid #E6E1ED" }}>
        <div className="mx-auto" style={{ maxWidth: 860, padding: "40px 20px 44px" }}>
          <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 11.5, letterSpacing: "0.12em", margin: "0 0 12px" }}>
            What&apos;s inside
          </p>
          <div style={{ borderTop: "1px solid #E6E1ED" }}>
            {sections.map((s, i) => (
              <div key={s.key} style={{ display: "grid", gridTemplateColumns: "40px 1fr 2fr", gap: 18, alignItems: "baseline", padding: "16px 4px", borderBottom: "1px solid #E6E1ED" }}>
                <span className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold text-[#DE3A2C]" style={{ fontSize: 12 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-[family-name:var(--font-inter)] font-semibold text-black" style={{ fontSize: 15 }}>{s.label}</span>
                <span className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 13 }}>{s.blurb}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto" style={{ maxWidth: 860, padding: "28px 20px 60px" }}>
        {fitment && fitmentBand && (
          <>
            <SectionHeading index="01 · Role Fitment" title="Matched against six weighted dimensions" blurb={`CV and experience compared against the ${fitment.roleTitle} job description. Scores below 100% usually reflect information missing from the CV, not an absence of capability.`} />
            <SummaryRow
              pillLabel={fitmentBand.label}
              pillTier={fitment.report.overallScore >= 80 ? "strong" : fitment.report.overallScore >= 50 ? "mid" : "weak"}
              gauge={<CombinedGauge value={fitment.report.overallScore} max={100} displayValue={`${Math.round(fitment.report.overallScore)}%`} caption="Overall match" diameter={150} band={fitmentBand} />}
            >
              {fitment.report.summary}
            </SummaryRow>
            <DimensionBars
              title="Dimension scores"
              rows={sortedFitmentCategories.map((c) => ({ label: c.label, value: c.score, max: 100, color: remapBand(getMatchBand(c.score)).textColor }))}
            />
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16, marginBottom: 22 }}>
              {sortedFitmentCategories.map((category) => (
                <CombinedCategoryCard key={category.key} category={category} />
              ))}
            </div>
            {fitment.report.strongPoints.length > 0 && (
              <div className="bg-[#E7F5EE] border" style={{ borderColor: "#CFEBDC", borderRadius: 16, padding: "22px 24px" }}>
                <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase" style={{ fontSize: 13, letterSpacing: "0.08em", color: "#1E8F5E", margin: "0 0 12px" }}>
                  Strong points
                </p>
                {fitment.report.strongPoints.map((point, i) => (
                  <div key={i} className="flex items-start" style={{ gap: 10, marginBottom: 9 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 2 }}>
                      <circle cx="8" cy="8" r="8" fill="#1E8F5E" />
                      <path d="M4.5 8.2l2.2 2.2 4.8-5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{point}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "16px 0 0", fontStyle: "italic" }}>
              Fitment is computed by matching CV content against the job description. Dimensions below 100% usually indicate information missing from the CV rather than an absence of capability.
            </p>
          </>
        )}

        {personality && (
          <>
            <SectionHeading index="02 · Personality" title="Big Five (OCEAN) working-style profile" blurb="Five research-backed traits describing working style, self-reported against a validated questionnaire. No score here is inherently good or bad — these describe tendencies, not ability." eyebrowColor="#4B4894" />
            <CondensedPersonalitySection candidateName={displayName} scores={personality.scores} />
          </>
        )}

        {interview && interviewBand && (
          <>
            <SectionHeading
              index="03 · AI Video Interview"
              title="Structured, proctored interview"
              eyebrowColor="#95324B"
              blurb={[
                "Scored against role-critical competencies, with a parallel read on delivery quality.",
                [
                  interview.report.approxDurationMinutes != null ? `~${interview.report.approxDurationMinutes} min` : null,
                  "English",
                  new Date(interview.updatedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
                ]
                  .filter(Boolean)
                  .join(" · "),
              ].join(" ")}
            />
            {interviewSections.has("scoreGauge") && (
              <>
                <SummaryRow
                  pillLabel={interviewBand.label}
                  pillTier={interview.report.overallScore >= 70 ? "strong" : interview.report.overallScore >= 40 ? "mid" : "weak"}
                  gauge={<CombinedGauge value={interview.report.overallScore} max={100} displayValue={`${Math.round(interview.report.overallScore)}%`} caption="Overall score" diameter={150} band={interviewBand} />}
                >
                  {interview.report.overallSummary}
                </SummaryRow>
                <DimensionBars
                  title="Interview Parameter"
                  rows={Object.entries(interview.report.skillMetrics ?? {}).map(([skill, score]) => ({
                    label: skill.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim(),
                    value: score,
                    max: 100,
                    color: score >= 70 ? "#1E8F5E" : score >= 40 ? "#BD7E12" : "#95324B",
                  }))}
                />
              </>
            )}

            {interviewSections.has("overview") && (
              <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 22, padding: "26px 30px", marginBottom: 22 }}>
                <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 11, letterSpacing: "0.1em", margin: "0 0 14px" }}>AI overview</p>
                <p className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>{interview.report.overallSummary}</p>
              </div>
            )}

            {interviewSections.has("skillReport") && (
              <>
                {interview.report.overallSkillScore != null && (
                  <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 12.5, margin: "0 0 20px" }}>
                    Overall skill score: <strong className="text-black">{Math.round(interview.report.overallSkillScore)}%</strong>
                  </p>
                )}
                {Object.keys(interview.report.skillReport).length > 0 && <CombinedSkillTable skillReport={interview.report.skillReport} />}
              </>
            )}

            {interviewSections.has("criteriaMatch") && typeof interview.report.skillMetrics?.criteriaMatch === "number" && (
              <CombinedCriteriaCard criteriaMatchScore={interview.report.skillMetrics.criteriaMatch} criteriaEvaluationTable={interview.report.criteriaEvaluationTable} />
            )}

            {interviewSections.has("skillEvaluation") && interview.report.criteriaEvaluationTable.length > 0 && (
              <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 22, padding: "26px 30px", marginBottom: 22 }}>
                <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 11, letterSpacing: "0.1em", margin: "0 0 16px" }}>
                  Skill-wise evaluation
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {interview.report.criteriaEvaluationTable.map((entry, i) => (
                    <div key={i} style={{ borderTop: i > 0 ? "1px solid #E6E1ED" : undefined, paddingTop: i > 0 ? 14 : 0 }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <h3 className="font-[family-name:var(--font-inter)] font-semibold text-black" style={{ fontSize: "1.02rem", margin: 0 }}>
                          {entry.criteria}
                        </h3>
                        <span
                          className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold uppercase"
                          style={{ fontSize: 10.5, letterSpacing: "0.04em", color: getCriteriaStatusColor(entry.status) }}
                        >
                          {entry.status}
                        </span>
                      </div>
                      <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                        {entry.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {((interviewSections.has("strengths") && interview.report.strengths) ||
              (interviewSections.has("integrity") && interview.report.integrityCheck)) && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 16, marginBottom: 22 }}>
                {interviewSections.has("strengths") && interview.report.strengths && (
                  <div className="bg-[#E7F5EE] border" style={{ borderColor: "#CFEBDC", borderRadius: 16, padding: "22px 24px" }}>
                    <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase" style={{ fontSize: 11, letterSpacing: "0.08em", color: "#1E8F5E", margin: "0 0 12px" }}>
                      What the interview evidenced
                    </p>
                    <p className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                      {splitBullets(interview.report.strengths).map((point, i, arr) => (
                        <span key={i}>
                          <InlineText text={point} />
                          {i < arr.length - 1 ? "; " : ""}
                        </span>
                      ))}
                    </p>
                  </div>
                )}

                {interviewSections.has("integrity") && (
                  <div
                    style={{
                      background: interview.report.flagForSuspiciousActivity ? "#F6E7EB" : "#E7F5EE",
                      border: `1px solid ${interview.report.flagForSuspiciousActivity ? "#E9CCD3" : "#CFEBDC"}`,
                      borderRadius: 16,
                      padding: "22px 24px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <p
                      className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]"
                      style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 16px" }}
                    >
                      Integrity assessment
                    </p>
                    <div className="flex items-center" style={{ gap: 8 }}>
                      <svg width="18" height="18" viewBox="0 0 16 16">
                        <circle cx="8" cy="8" r="8" fill={interview.report.flagForSuspiciousActivity ? "#95324B" : "#1E8F5E"} />
                        {interview.report.flagForSuspiciousActivity ? (
                          <path d="M8 4.5v4.2M8 11.2h.01" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                        ) : (
                          <path d="M4.5 8.2l2.2 2.2 4.8-5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                      </svg>
                      <span
                        className="font-[family-name:var(--font-inter)] font-semibold"
                        style={{ fontSize: 15, color: interview.report.flagForSuspiciousActivity ? "#95324B" : "#1E8F5E" }}
                      >
                        {interview.report.flagForSuspiciousActivity ? "Flagged" : "No issues detected"}
                      </span>
                    </div>
                    <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "10px 0 0" }}>
                      {interview.report.integrityCheck ||
                        (interview.report.flagForSuspiciousActivity
                          ? "Suspicious activity was flagged during this interview."
                          : "No suspicious activity flagged during this interview.")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {interviewSections.has("recommendation") && interviewRecommendation && (
              <div className="bg-[#F6E7EB] border flex items-start" style={{ borderColor: "#E9CCD3", borderRadius: 16, padding: "22px 26px", marginBottom: 22, gap: 14 }}>
                <svg width="20" height="20" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 2 }}>
                  <circle cx="8" cy="8" r="8" fill="#95324B" />
                  <path d="M8 4.5v4.2M8 11.2h.01" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <div>
                  <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase" style={{ fontSize: 13, letterSpacing: "0.08em", color: "#95324B", margin: "0 0 6px" }}>
                    Recommendation
                  </p>
                  <p className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
                    <InlineText text={interviewRecommendation} />
                  </p>
                </div>
              </div>
            )}

            {interviewSections.has("roadmap") && interview.report.roadmap && <CombinedRoadmapTimeline roadmap={interview.report.roadmap} />}

            {interview.report.videoReport && (
              <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 22, padding: "26px 30px", marginBottom: 22 }}>
                <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 11, letterSpacing: "0.1em", margin: "0 0 14px" }}>Video &amp; delivery notes</p>
                <p className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{interview.report.videoReport}</p>
              </div>
            )}
            <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "16px 0 0", fontStyle: "italic" }}>
              Interview conducted on an AI-proctored platform. Scores are generated from the recorded session; the full video transcript is available to hiring teams on request.
            </p>
          </>
        )}

        {references && refBand && (
          <>
            <SectionHeading index="04 · Reference Check" title="Rated by verified former colleagues" blurb="Independently rated across seven categories. Respondent identities are withheld in this shareable version." />
            <SummaryRow
              pillLabel={references.overallScore >= 4 ? "Strong overall" : references.overallScore >= 3 ? "Solid overall" : "Mixed signal"}
              pillTier={references.overallScore >= 4 ? "strong" : references.overallScore >= 3 ? "mid" : "weak"}
              gauge={<CombinedGauge value={references.overallScore} max={5} displayValue={references.overallScore.toFixed(1)} caption="Out of 5" diameter={150} band={refBand} />}
            >
              {`Colleagues rated ${displayName.split(/\s+/)[0]} across seven categories, based on ${references.referees.length} verified reference${references.referees.length === 1 ? "" : "s"}.`}
            </SummaryRow>
            <DimensionBars
              title="Category ratings"
              rows={[...references.categoryScores]
                .sort((a, b) => b.value - a.value)
                .map((cat) => ({ label: cat.label, value: cat.value, max: 5, color: cat.value >= 4 ? "#1E8F5E" : cat.value >= 3 ? "#BD7E12" : "#95324B" }))}
            />
            {references.referees.some((r) => r.overallFeedback?.trim()) && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginBottom: 22 }}>
                {references.referees
                  .filter((r) => r.overallFeedback?.trim())
                  .map((r, i) => (
                    <div key={i} className="bg-white" style={{ borderRadius: "0 16px 16px 0", border: "1px solid #E6E1ED", borderLeftWidth: 3, borderLeftColor: "#DE3A2C", padding: "20px 20px 16px" }}>
                      <span className="font-[family-name:var(--font-fraunces)]" style={{ fontSize: 30, color: "#DE3A2C", lineHeight: 1, display: "block", marginBottom: 4 }}>&ldquo;</span>
                      <p className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 13.5, lineHeight: 1.6, fontStyle: "italic", margin: "0 0 10px" }}>{r.overallFeedback}</p>
                      <footer className="font-[family-name:var(--font-ibm-plex-mono)] text-[#6C6779]" style={{ fontSize: 10.5, letterSpacing: "0.04em" }}>— Reference {i + 1} · Verified</footer>
                    </div>
                  ))}
              </div>
            )}
            <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "16px 0 0" }}>
              Each reference was invited by the candidate and completed the rating independently through Merito HUB. Respondent names, email addresses and employer details are held on record and disclosed only to a hiring employer on request, with the candidate&apos;s consent.
            </p>
          </>
        )}

        <div style={{ marginTop: 56 }}>
          <p className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]" style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 20px" }}>
            How to read this report
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16, marginBottom: 30 }}>
            {[
              { label: "Role Fitment", color: "#1E8F5E", body: "AI comparison of the CV against a specific job description, scored across six dimensions. Measures documented alignment, not potential." },
              { label: "Personality", color: "#4B4894", body: "A Big Five (OCEAN) questionnaire measuring five stable dimensions of working style. Scores describe tendencies, not ability." },
              { label: "AI Interview", color: "#95324B", body: "Structured, proctored interview scored against role-critical competencies, with a parallel read on delivery quality." },
              { label: "Reference Check", color: "#1E8F5E", body: "Independent ratings from people who have worked with the candidate, across seven standard categories on a five-point scale." },
            ].map((card) => (
              <div key={card.label} className="bg-white border border-black/[0.08]" style={{ borderRadius: 16, padding: 20 }}>
                <span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: card.color, marginBottom: 12 }} />
                <p className="font-[family-name:var(--font-inter)] font-semibold text-black" style={{ fontSize: 14.5, margin: "0 0 8px" }}>{card.label}</p>
                <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background: "#15121F", padding: "40px 20px" }}>
        <div className="mx-auto" style={{ maxWidth: 860 }}>
          <p className="font-[family-name:var(--font-fraunces)] font-semibold text-white" style={{ fontSize: 16, margin: "0 0 6px" }}>
            Merito HUB
          </p>
          <p className="font-[family-name:var(--font-inter)] text-[#B8B3C8]" style={{ fontSize: 13, margin: 0, maxWidth: "52ch" }}>
            The talent partner that turns job briefs into dream hires.
          </p>
          <p className="font-[family-name:var(--font-ibm-plex-mono)] text-[#7A7590]" style={{ fontSize: 11, margin: "10px 0 0" }}>
            Career Corner Education Pvt. Ltd. · merito.ai · admin@merito.ai · +91 97676-63123
          </p>
        </div>
      </div>
    </main>
  );
}
