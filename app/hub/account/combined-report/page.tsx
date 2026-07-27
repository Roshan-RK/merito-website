import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getReferenceCheckStatus, computeReferenceReport } from "@/lib/referenceChecks";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import { nameFromEmail, type Scores } from "@/lib/personality";
import ResumeMatchGauge, { getMatchBand } from "../report/ResumeMatchGauge";
import ResumeMatchCategoryCard from "../report/ResumeMatchCategoryCard";
import CondensedPersonalitySection from "./CondensedPersonalitySection";
import InterviewScoreGauge, { getScoreBand } from "../interview/InterviewScoreGauge";
import ParameterScoreTile from "../interview/ParameterScoreTile";

function splitBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function SectionHeading({ index, title, blurb }: { index: string; title: string; blurb: string }) {
  return (
    <div style={{ margin: "48px 0 20px" }}>
      <p className="font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24]" style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 6px" }}>
        SECTION {index}
      </p>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.5rem", margin: "0 0 6px" }}>
        {title}
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, margin: 0 }}>
        {blurb}
      </p>
    </div>
  );
}

function SummaryTile({ label, value, sub, subColor }: { label: string; value: string; sub: string; subColor: string }) {
  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 18 }}>
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
        {label}
      </p>
      <p className="font-[family-name:var(--font-gabarito)] font-semibold text-[#ed1a24]" style={{ fontSize: "1.7rem", margin: "0 0 4px" }}>
        {value}
      </p>
      <p className="font-[family-name:var(--font-poppins)] font-semibold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.04em", margin: 0, color: subColor }}>
        {sub}
      </p>
    </div>
  );
}

export default async function CombinedReportPage({
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

  let fitment: { roleTitle: string; displayName: string; report: ResumeMatchReportReady } | null = null;
  if (include.has("fitment")) {
    const { data: leads } = await supabase
      .from("fitment_leads")
      .select("role_title, name, resume_match_status, resume_match_raw")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const current = leads?.[0];
    if (current) {
      const unlocked = await isReportUnlocked(user.id, current.role_title);
      if (unlocked && current.resume_match_status === "READY" && current.resume_match_raw) {
        fitment = {
          roleTitle: current.role_title,
          displayName: current.name || nameFromEmail(user.email ?? ""),
          report: current.resume_match_raw as ResumeMatchReportReady,
        };
      }
    }
  }

  const roleTitle = roleTitleParam ?? fitment?.roleTitle ?? null;

  let personality: { scores: Scores } | null = null;
  if (include.has("personality") && roleTitle) {
    const { data: existing } = await supabase
      .from("personality_tests")
      .select("scores, validity")
      .eq("user_id", user.id)
      .eq("role_title", roleTitle)
      .maybeSingle();
    if (existing?.scores && existing?.validity) {
      personality = { scores: existing.scores as Scores };
    }
  }

  let interview: { roleTitle: string; report: InterviewReportReady } | null = null;
  if (include.has("interview")) {
    let query = supabase.from("fitment_interviews").select("role_title, status, report_raw").eq("user_id", user.id);
    if (roleTitle) query = query.eq("role_title", roleTitle);
    const { data: row } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (row && row.status === "ready" && row.report_raw) {
      interview = { roleTitle: row.role_title, report: row.report_raw as InterviewReportReady };
    }
  }

  let references: ReturnType<typeof computeReferenceReport> | null = null;
  if (include.has("references")) {
    const status = await getReferenceCheckStatus(user.id);
    if (status?.status === "completed") {
      references = computeReferenceReport(status.referees);
    }
  }

  if (!fitment && !personality && !interview && !references) {
    redirect("/hub/account");
  }

  const displayName = fitment?.displayName || nameFromEmail(user.email ?? "");
  const primaryRole = fitment?.roleTitle || interview?.roleTitle || roleTitle || "—";
  const reportDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  const reportId = `MH-${user.id.split("-")[0].toUpperCase()}`;

  const sections: { key: string; label: string; blurb: string }[] = [];
  if (fitment) sections.push({ key: "fitment", label: "Role Fitment Analysis", blurb: "CV matched against the job description across six dimensions" });
  if (personality) sections.push({ key: "personality", label: "Personality Profile", blurb: "Big Five (OCEAN) traits and what each means at work" });
  if (interview) sections.push({ key: "interview", label: "AI Video Interview", blurb: "Skill-wise scoring, delivery parameters and integrity check" });
  if (references) sections.push({ key: "references", label: "Reference Check", blurb: `Seven categories rated by ${references.referees.length} verified former colleague${references.referees.length === 1 ? "" : "s"}` });

  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "100vh" }}>
      <div className="print:hidden" style={{ padding: "16px 20px 0" }}>
        <Link href="/hub/account" className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 13 }}>
          ← Back to dashboard
        </Link>
      </div>

      <div style={{ background: "#12121f", padding: "40px 20px 32px" }}>
        <div className="mx-auto" style={{ maxWidth: 820 }}>
          <Image src="/logo.png" alt="Merito" width={100} height={28} style={{ height: 24, width: "auto" }} />
          <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]" style={{ fontSize: 11, letterSpacing: "0.08em", margin: "28px 0 10px" }}>
            Candidate credential report
          </p>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "2rem", lineHeight: 1.2, margin: "0 0 14px" }}>
            Four assessments. One <span style={{ color: "#ed1a24" }}>verified</span> profile.
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-[#c7c7cf]" style={{ fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
            A consolidated, evidence-backed view of role fitment, personality, interview performance and peer references — assembled by Merito HUB and shareable with any employer.
          </p>
        </div>
      </div>

      <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 20px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 20, marginBottom: 24 }}>
          <div>
            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 6px" }}>Candidate</p>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: 0 }}>{displayName}</p>
          </div>
          <div>
            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 6px" }}>Target role</p>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: 0 }}>{primaryRole}</p>
          </div>
          <div>
            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 6px" }}>Report date</p>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: 0 }}>{reportDate}</p>
          </div>
          <div>
            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 6px" }}>Report ID</p>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: 0 }}>{reportId}</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 32 }}>
          {fitment && (
            <SummaryTile
              label="Role fitment"
              value={`${Math.round(fitment.report.overallScore)}%`}
              sub={getMatchBand(fitment.report.overallScore).label}
              subColor={getMatchBand(fitment.report.overallScore).textColor}
            />
          )}
          {interview && (
            <SummaryTile
              label="AI interview score"
              value={`${Math.round(interview.report.overallScore * 10)}%`}
              sub={getScoreBand(interview.report.overallScore).label}
              subColor={getScoreBand(interview.report.overallScore).textColor}
            />
          )}
          {references && (
            <SummaryTile
              label="Reference check"
              value={`${references.overallScore.toFixed(1)}/5`}
              sub={`${references.referees.length} reference${references.referees.length === 1 ? "" : "s"}`}
              subColor="#9c9c9c"
            />
          )}
          {personality && <SummaryTile label="Personality profile" value="5/5" sub="Traits measured" subColor="#9c9c9c" />}
        </div>

        <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 12 }}>
          <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 12px" }}>
            What&apos;s inside
          </p>
          {sections.map((s, i) => (
            <div key={s.key} className="flex items-start" style={{ gap: 14, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid #f0e6ea" }}>
              <span className="font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24]" style={{ fontSize: 12.5, width: 24, flexShrink: 0 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13.5, margin: "0 0 2px" }}>{s.label}</p>
                <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, margin: 0 }}>{s.blurb}</p>
              </div>
            </div>
          ))}
        </div>

        {fitment && (
          <>
            <SectionHeading index="01" title="Role Fitment Analysis" blurb={`CV and experience matched against the ${fitment.roleTitle} job description across six weighted dimensions.`} />
            <div
              className="bg-white border border-black/[0.08]"
              style={{ borderRadius: 14, padding: 20, display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 24, alignItems: "center", marginBottom: 20 }}
            >
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>{fitment.report.summary}</p>
              <div className="flex items-center justify-center">
                <ResumeMatchGauge percent={fitment.report.overallScore} />
              </div>
            </div>
            <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 16px" }}>
                Dimension scores
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {fitment.report.categories.map((category) => {
                  const band = getMatchBand(category.score);
                  return (
                    <div key={category.key} className="flex items-center" style={{ gap: 10 }}>
                      <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, width: 150, flexShrink: 0 }}>
                        {category.label}
                      </span>
                      <div style={{ flex: 1, height: 8, borderRadius: 50, background: "#f0e6ea" }}>
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 50,
                            width: `${Math.min(100, Math.max(0, category.score))}%`,
                            background: band.textColor,
                          }}
                        />
                      </div>
                      <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12.5, width: 40, textAlign: "right" }}>
                        {category.score}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14, marginBottom: 20 }}>
              {fitment.report.categories.map((category) => (
                <ResumeMatchCategoryCard key={category.key} category={category} />
              ))}
            </div>
            {fitment.report.strongPoints.length > 0 && (
              <div className="bg-[#eefdf1]" style={{ borderRadius: 14, padding: "14px 16px" }}>
                <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#16803c]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
                  Strong points
                </p>
                {fitment.report.strongPoints.map((point, i) => (
                  <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.7, margin: "0 0 8px" }}>✓ {point}</p>
                ))}
              </div>
            )}
          </>
        )}

        {personality && (
          <>
            <SectionHeading index="02" title="Personality Profile — Big Five (OCEAN)" blurb="Five research-backed traits describing working style — no score is inherently good or bad." />
            <CondensedPersonalitySection candidateName={displayName} scores={personality.scores} />
          </>
        )}

        {interview && (
          <>
            <SectionHeading index="03" title="AI Video Interview" blurb="Structured, proctored interview scored on role-critical skills and delivery." />
            <div
              className="bg-white border border-black/[0.08]"
              style={{ borderRadius: 14, padding: 20, display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 24, alignItems: "center", marginBottom: 20 }}
            >
              <div>
                <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 12px" }}>
                  Delivery parameters
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
                  {Object.entries(interview.report.skillMetrics ?? {}).map(([skill, score]) => (
                    <ParameterScoreTile key={skill} skill={skill} score={score} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center">
                <InterviewScoreGauge score={interview.report.overallScore} />
              </div>
            </div>

            <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>AI overview</p>
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>{interview.report.overallSummary}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14, marginBottom: 20 }}>
              {interview.report.strengths && (
                <div className="bg-[#eefdf1]" style={{ borderRadius: 14, padding: "14px 16px" }}>
                  <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#16803c]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>Strengths</p>
                  {splitBullets(interview.report.strengths).map((point, i) => (
                    <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.7, margin: "0 0 8px" }}>✓ {point}</p>
                  ))}
                </div>
              )}
              {interview.report.areasOfImprovement && (
                <div className="bg-[#fdeced]" style={{ borderRadius: 14, padding: "14px 16px" }}>
                  <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>Areas to improve</p>
                  {splitBullets(interview.report.areasOfImprovement).map((point, i) => (
                    <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.7, margin: "0 0 8px" }}>✗ {point}</p>
                  ))}
                </div>
              )}
            </div>

            {interview.report.roadmap && (
              <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>Improvement roadmap</p>
                <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{interview.report.roadmap}</p>
              </div>
            )}

            {interview.report.feedbackToInterviewer && (
              <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
                  Evaluator notes for hiring teams
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
                  {interview.report.feedbackToInterviewer}
                </p>
              </div>
            )}

            <div
              className={interview.report.flagForSuspiciousActivity ? "bg-[#fdeced]" : "bg-[#eefdf1]"}
              style={{ borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}
            >
              <p
                className="font-[family-name:var(--font-poppins)] font-bold uppercase"
                style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 8px", color: interview.report.flagForSuspiciousActivity ? "#ed1a24" : "#16803c" }}
              >
                Integrity assessment · {interview.report.flagForSuspiciousActivity ? "Flagged" : "No issues"}
              </p>
              {interview.report.integrityCheck && (
                <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>{interview.report.integrityCheck}</p>
              )}
            </div>

            {interview.report.videoReport && (
              <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>Video &amp; delivery notes</p>
                <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{interview.report.videoReport}</p>
              </div>
            )}
          </>
        )}

        {references && (
          <>
            <SectionHeading index="04" title="Reference Check" blurb="Verified former colleagues independently rated the candidate across seven categories. Respondent identities are withheld in this shareable version." />
            <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 16px" }}>
                Category ratings — overall {references.overallScore.toFixed(1)}/5
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {references.categoryScores.map((cat) => (
                  <div key={cat.category} className="flex items-center" style={{ gap: 10 }}>
                    <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, width: 170, flexShrink: 0 }}>{cat.label}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 50, background: "#f0e6ea" }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 50,
                          width: `${(cat.value / 5) * 100}%`,
                          background: cat.value >= 4 ? "#16803c" : cat.value >= 3 ? "#ed1a24" : "#9c9c9c",
                        }}
                      />
                    </div>
                    <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12.5, width: 28, textAlign: "right" }}>
                      {cat.value > 0 ? cat.value.toFixed(1) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {references.referees.some((r) => r.overallFeedback?.trim()) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {references.referees
                  .filter((r) => r.overallFeedback?.trim())
                  .map((r, i) => (
                    <div key={i} className="bg-[#fdeced]" style={{ borderRadius: 10, padding: "12px 16px" }}>
                      <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, fontStyle: "italic", margin: 0 }}>&ldquo;{r.overallFeedback}&rdquo;</p>
                      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11.5, margin: "4px 0 0" }}>— Reference {i + 1} · Verified</p>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}

        <div style={{ borderTop: "1px solid #f0e6ea", marginTop: 48, paddingTop: 20 }}>
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: "0 0 4px" }}>
            Merito HUB — the talent partner that turns job briefs into dream hires.
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11.5, margin: 0 }}>
            Career Corner Education Pvt. Ltd. · merito.ai · admin@merito.ai
          </p>
        </div>
      </div>
    </main>
  );
}
