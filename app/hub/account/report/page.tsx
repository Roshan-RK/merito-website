import { redirect } from "next/navigation";
import { Download, CheckCircle2, XCircle, FileText, Briefcase } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { isProductUnlocked } from "@/lib/productUnlocks";
import { DEFAULT_LEVEL, type CandidateLevel } from "@/lib/razorpay/pricing";
import { getCandidateResumeDetails, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import ResumeMatchCategoryCard, { CATEGORY_ICONS } from "./ResumeMatchCategoryCard";
import ResumeMatchGauge, { getMatchBandDark } from "./ResumeMatchGauge";
import CandidateStatsCard from "./CandidateStatsCard";
import CandidateProfile from "./CandidateProfile";
import ReportLockedState from "./ReportLockedState";
import ExportPreviewButton from "../ExportPreviewButton";

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";

export default async function FullReportPage({
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

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, role_title, score, name, resume_match_status, resume_match_raw, ib_applied_job_id, candidate_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!leads || leads.length === 0) {
    redirect("/hub/account");
  }
  const current = leadIdParam
    ? leads.find(l => l.id === leadIdParam) || leads[0]
    : leads[0];
  const level = (current.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;
  const unlocked = await isReportUnlocked(user.id, current.id, current.role_title);

  if (!unlocked) {
    const [personalityUnlocked, referencesUnlocked] = await Promise.all([
      isProductUnlocked(user.id, "personality"),
      isProductUnlocked(user.id, "references"),
    ]);
    const bundleEligible = !personalityUnlocked && !referencesUnlocked;

    const lockedReport =
      current.resume_match_status === "READY" && current.resume_match_raw
        ? (current.resume_match_raw as ResumeMatchReportReady)
        : null;
    const topCategory = lockedReport
      ? [...lockedReport.categories].sort((a, b) => b.score - a.score)[0] ?? null
      : null;

    const candidateDetails = current.ib_applied_job_id
      ? await getCandidateResumeDetails(current.ib_applied_job_id).catch((err) => {
          console.error("getCandidateResumeDetails failed, rendering locked report without skill tags", err);
          return null;
        })
      : null;

    return (
      <main>
        <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>
              Fitment report
            </h1>
            <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, margin: 0 }}>
              A dimension-by-dimension breakdown of your CV against the {current.role_title} JD.
            </p>
          </div>
          <ReportLockedState
            leadId={current.id}
            roleTitle={current.role_title}
            level={level}
            bundleEligible={bundleEligible}
            skillTags={candidateDetails?.skills ?? []}
            previewSummary={lockedReport?.summary ?? null}
            previewCategory={topCategory ? { label: topCategory.label, score: topCategory.score } : null}
          />
        </div>
      </main>
    );
  }

  if (current.resume_match_status !== "READY" || !current.resume_match_raw) {
    redirect("/hub/account");
  }

  const report = current.resume_match_raw as ResumeMatchReportReady;

  const candidateDetails = current.ib_applied_job_id
    ? await getCandidateResumeDetails(current.ib_applied_job_id).catch((err) => {
        console.error("getCandidateResumeDetails failed, rendering report without candidate profile", err);
        return null;
      })
    : null;

  // This route only ever renders once resume_match_status is READY and
  // isReportUnlocked() has passed (both redirect away above) — so unlike the
  // mockup's single panel that toggles between a locked teaser and the full
  // breakdown, there is no reachable "locked" state here to render.
  const sortedCategories = [...report.categories].sort((a, b) => b.score - a.score);
  const strongest = sortedCategories[0];
  const weakest = sortedCategories[sortedCategories.length - 1];
  const weakestBand = weakest ? getMatchBandDark(weakest.score) : null;

  const hasProfile = Boolean(
    candidateDetails &&
      (candidateDetails.education.length > 0 ||
        candidateDetails.experience.length > 0 ||
        candidateDetails.certifications.length > 0 ||
        candidateDetails.projects.length > 0)
  );

  const jumpLinks = [
    { id: "summary", label: "Summary" },
    { id: "dimensions", label: "Dimensions" },
    { id: "strengths", label: "Strengths & gaps" },
    { id: "profile", label: "Profile" },
  ];

  return (
    <main>
      <div className="px-4 py-6 pb-16 md:px-8 md:py-7" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.5rem", margin: 0 }}>
            Fitment report
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 13.5, margin: "4px 0 0" }}>
            Generated by comparing your CV against the job description.
          </p>
          <span
            className="inline-flex items-center font-[family-name:var(--font-poppins)] text-white/50"
            style={{ gap: 6, marginTop: 10, borderRadius: 50, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", padding: "5px 12px", fontSize: 12 }}
          >
            <Briefcase size={12} strokeWidth={2} /> {current.role_title}
          </span>
        </div>

        <div
          className="border border-white/[0.08] flex flex-col"
          style={{ borderRadius: 14, padding: 24, gap: 16, background: "rgb(29,25,31)" }}
        >
          <div className="flex items-start justify-between flex-wrap" style={{ gap: 16 }}>
            <div className="flex items-center" style={{ gap: 10 }}>
              <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
                <FileText size={18} strokeWidth={2} />
              </div>
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 15 }}>
                Detailed fitment report
              </span>
              <span
                className="font-[family-name:var(--font-poppins)] font-semibold"
                style={{ borderRadius: 50, padding: "4px 10px", fontSize: 11, background: "rgba(53,182,130,0.15)", color: "rgb(53,182,130)" }}
              >
                Unlocked
              </span>
            </div>
            <div className="flex items-center flex-wrap shrink-0" style={{ gap: 8 }}>
              <ExportPreviewButton
                exportUrl="/api/hub/report/export"
                title="Fitment report: export preview"
              />
              <a
                href="/api/hub/report/export"
                download
                className="flex items-center hover:bg-white/[0.06] transition-colors font-[family-name:var(--font-poppins)] font-medium text-white"
                style={{ gap: 6, fontSize: 12, borderRadius: 12, padding: "7px 12px", background: "rgb(21,18,22)", border: "1px solid rgb(49,47,55)" }}
              >
                <Download size={13} strokeWidth={2} /> Download
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center" style={{ gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Resume match for {current.role_title}
            </p>
            {candidateDetails && candidateDetails.skills.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                {candidateDetails.skills.map((skill) => (
                  <span
                    key={skill}
                    className="bg-white/[0.05] border border-white/[0.08] font-[family-name:var(--font-poppins)] text-white/60"
                    style={{ fontSize: 12, borderRadius: 50, padding: "6px 14px" }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0" style={{ margin: "0 auto" }}>
            <ResumeMatchGauge percent={report.overallScore} />
          </div>
          </div>
        </div>

        <div className="print:hidden flex flex-wrap" style={{ gap: 8 }}>
          {jumpLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="hover:border-[#ed1a24]/40 hover:text-white transition-colors font-[family-name:var(--font-poppins)] font-medium text-white/55"
              style={{ fontSize: 12, borderRadius: 50, padding: "6px 14px", background: "rgb(29,25,31)", border: "1px solid rgb(49,47,55)" }}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div id="summary" style={{ borderRadius: 14, padding: 20, scrollMarginTop: 24, background: "rgb(29,25,31)", border: "1px solid rgb(49,47,55)" }}>
          <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "0 0 8px" }}>
            Assessment summary
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-white/70" style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            {report.summary}
          </p>
        </div>

        <div id="dimensions" style={{ scrollMarginTop: 24 }}>
          <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "0 0 10px" }}>
            Dimension scores
          </p>
          {strongest && weakest && weakestBand && (
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10, marginBottom: 12 }}>
              <div className="flex items-center bg-[#16803c]/10 border border-[#16803c]/25" style={{ gap: 10, borderRadius: 14, padding: "10px 14px" }}>
                {(() => {
                  const StrongestIcon = CATEGORY_ICONS[strongest.key];
                  return <StrongestIcon size={16} strokeWidth={2} className="shrink-0 text-[#3FCB8C]" />;
                })()}
                <span className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12 }}>
                  <span className="font-semibold text-[#3FCB8C]">Strongest —</span>{" "}
                  <span className="text-white/70">{strongest.label} ({strongest.score}%)</span>
                </span>
              </div>
              <div
                className="flex items-center"
                style={{ gap: 10, borderRadius: 14, padding: "10px 14px", background: weakestBand.trackColor, border: `1px solid ${weakestBand.textColor}40` }}
              >
                {(() => {
                  const FocusIcon = CATEGORY_ICONS[weakest.key];
                  return <FocusIcon size={16} strokeWidth={2} className="shrink-0" style={{ color: weakestBand.textColor }} />;
                })()}
                <span className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12 }}>
                  <span className="font-semibold" style={{ color: weakestBand.textColor }}>Focus area —</span>{" "}
                  <span className="text-white/70">{weakest.label} ({weakest.score}%)</span>
                </span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            {report.categories.map((category) => (
              <ResumeMatchCategoryCard key={category.key} category={category} />
            ))}
          </div>
        </div>

        <div id="strengths" className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, scrollMarginTop: 24 }}>
          <div className="bg-[#16803c]/10 border border-[#16803c]/20" style={{ borderRadius: 14, padding: 16 }}>
            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#3FCB8C]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Strong points
            </p>
            <div className="flex flex-col" style={{ gap: 8 }}>
              {report.strongPoints.map((point, i) => (
                <div key={i} className="flex items-start" style={{ gap: 8 }}>
                  <CheckCircle2 size={14} strokeWidth={2} className="shrink-0 text-[#3FCB8C]" style={{ marginTop: 2 }} />
                  <span className="font-[family-name:var(--font-poppins)] text-white/70" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#ed1a24]/10 border border-[#ed1a24]/20" style={{ borderRadius: 14, padding: 16 }}>
            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#E8798F]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Weak points
            </p>
            <div className="flex flex-col" style={{ gap: 8 }}>
              {report.weakPoints.map((point, i) => (
                <div key={i} className="flex items-start" style={{ gap: 8 }}>
                  <XCircle size={14} strokeWidth={2} className="shrink-0 text-[#E8798F]" style={{ marginTop: 2 }} />
                  <span className="font-[family-name:var(--font-poppins)] text-white/70" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div id="profile" style={{ scrollMarginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Professional details
            </p>
            <CandidateStatsCard
              email={user.email ?? null}
              phoneNumber={candidateDetails?.phoneNumber ?? null}
              location={candidateDetails?.location ?? null}
              totalExperience={candidateDetails?.totalExperience ?? null}
              experience={candidateDetails?.experience ?? []}
            />
          </div>

          {hasProfile && candidateDetails && (
            <CandidateProfile
              education={candidateDetails.education}
              experience={candidateDetails.experience}
              certifications={candidateDetails.certifications}
              projects={candidateDetails.projects}
            />
          )}
        </div>
      </div>
    </main>
  );
}
