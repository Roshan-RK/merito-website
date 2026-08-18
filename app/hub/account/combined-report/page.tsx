import { redirect } from "next/navigation";
import Link from "next/link";
import type { ComponentType } from "react";
import { Eye, Download, FileText, Brain, Mic, Users, Lock, ArrowRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { loadCombinedReportData } from "@/lib/combinedReportData";
import { getMatchBand } from "../report/ResumeMatchGauge";
import { remapBandDark } from "./combinedBandColors";
import { TRAITS, TRAIT_NAME } from "@/lib/personality";
import CombinedGauge from "./CombinedGauge";
import CombinedReportActions from "./CombinedReportActions";

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";

function StatusCard({
  icon: Icon,
  title,
  included,
  href,
  children,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  included: boolean;
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12, gap: 10 }}>
        <div className="flex items-center" style={{ gap: 9 }}>
          <Icon size={16} strokeWidth={2} className="text-[#ed1a24]" />
          <span className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 14 }}>
            {title}
          </span>
        </div>
        {included ? (
          <span
            className="bg-[#3FCB8C]/15 font-[family-name:var(--font-poppins)] font-semibold text-[#3FCB8C]"
            style={{ fontSize: 10, borderRadius: 50, padding: "3px 10px", whiteSpace: "nowrap" }}
          >
            Included
          </span>
        ) : (
          <span
            className="flex items-center bg-white/[0.06] font-[family-name:var(--font-poppins)] font-semibold uppercase text-white/40"
            style={{ gap: 4, fontSize: 9.5, letterSpacing: "0.04em", borderRadius: 50, padding: "3px 10px", whiteSpace: "nowrap" }}
          >
            <Lock size={9} strokeWidth={2.2} /> Not included
          </span>
        )}
      </div>
      {included ? (
        children
      ) : (
        <Link
          href={href}
          className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24] hover:text-white transition-colors"
          style={{ gap: 6, fontSize: 12.5 }}
        >
          Complete this to include it <ArrowRight size={12} strokeWidth={2} />
        </Link>
      )}
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
  const DEFAULT_INTERVIEW_SECTIONS =
    "scoreGauge,overview,skillReport,criteriaMatch,skillEvaluation,strengths,integrity,roadmap";
  const interviewSectionsParam = typeof params.interviewSections === "string" ? params.interviewSections : DEFAULT_INTERVIEW_SECTIONS;

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

  const fitmentBandDark = fitment ? remapBandDark(getMatchBand(fitment.report.overallScore)) : null;

  let personalitySummary: string | null = null;
  if (personality) {
    const ranked = [...TRAITS].sort((a, b) => personality.scores[b].pct - personality.scores[a].pct);
    const [top1, top2] = ranked;
    personalitySummary = `Highest in ${TRAIT_NAME[top1]} (${personality.scores[top1].pct}%) and ${TRAIT_NAME[top2]} (${personality.scores[top2].pct}%).`;
  }

  const cards: {
    key: string;
    icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    title: string;
    included: boolean;
    href: string;
    summary: string | null;
  }[] = [
    {
      key: "fitment",
      icon: FileText,
      title: "Fitment report",
      included: Boolean(fitment),
      href: "/hub/account/report",
      summary: fitment ? `${Math.round(fitment.report.overallScore)}% fitment for ${fitment.roleTitle}. ${fitment.report.summary}` : null,
    },
    {
      key: "personality",
      icon: Brain,
      title: "Personality",
      included: Boolean(personality),
      href: "/hub/account/personality",
      summary: personalitySummary,
    },
    {
      key: "interview",
      icon: Mic,
      title: "Mock interview",
      included: Boolean(interview),
      href: "/hub/account/interview",
      summary: interview ? `Scored ${Math.round(interview.report.overallScore)}% on your mock interview for ${interview.roleTitle}, with skill-wise feedback.` : null,
    },
    {
      key: "references",
      icon: Users,
      title: "Reference checks",
      included: Boolean(references),
      href: "/hub/account/references",
      summary: references
        ? `${references.overallScore.toFixed(1)} / 5 overall across 7 categories, based on ${references.referees.length} completed reference${references.referees.length === 1 ? "" : "s"}.`
        : null,
    },
  ];
  const includedCount = cards.filter((c) => c.included).length;

  // Preview/Download/Share all need the same role + include + interviewSections
  // context the page itself was loaded with, so every downstream link/action
  // reuses these exact query values rather than re-deriving them.
  const linkParams = new URLSearchParams({ include: includeParam, role: primaryRole, interviewSections: interviewSectionsParam }).toString();
  const printHref = `/hub/account/combined-report/print?${linkParams}`;
  const downloadHref = `/api/hub/export/combined?${linkParams}`;

  return (
    <main>
      <div className="mx-auto" style={{ maxWidth: 900, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Consolidated report
          </p>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.7rem", margin: 0 }}>
            Everything about you, in one document
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
            {includedCount} of 4 sections included right now. Updates automatically as you complete more.
          </p>
        </div>

        <div
          className="bg-[#141416] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between"
          style={{ borderRadius: 14, padding: 20, gap: 18 }}
        >
          <div className="flex items-center" style={{ gap: 16 }}>
            {fitment && fitmentBandDark ? (
              <CombinedGauge
                value={fitment.report.overallScore}
                max={100}
                displayValue={`${Math.round(fitment.report.overallScore)}%`}
                diameter={64}
                band={fitmentBandDark}
                numberColor="#fff"
                numberFontVar="var(--font-gabarito)"
                captionFontVar="var(--font-poppins)"
              />
            ) : (
              <div
                className="flex items-center justify-center bg-[#ed1a24]/15 font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24]"
                style={{ width: 64, height: 64, borderRadius: "50%", fontSize: 22, border: "1px solid rgba(237,26,36,0.3)", flexShrink: 0 }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 14, margin: 0 }}>
                {displayName}, {primaryRole}
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 12, margin: "3px 0 0" }}>
                Updates automatically as you complete more
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
            <a
              href={printHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white"
              style={{ gap: 6, fontSize: 12.5, borderRadius: 50, padding: "7px 14px", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Eye size={13} strokeWidth={2} /> Preview
            </a>
            <a
              href={downloadHref}
              download
              className="flex items-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white"
              style={{ gap: 6, fontSize: 12.5, borderRadius: 50, padding: "7px 14px", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Download size={13} strokeWidth={2} /> Download
            </a>
            <CombinedReportActions roleTitle={primaryRole} include={includeParam} interviewSections={interviewSectionsParam} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16 }}>
          {cards.map((card) => (
            <StatusCard key={card.key} icon={card.icon} title={card.title} included={card.included} href={card.href}>
              {card.summary && (
                <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  {card.summary}
                </p>
              )}
            </StatusCard>
          ))}
        </div>
      </div>
    </main>
  );
}
