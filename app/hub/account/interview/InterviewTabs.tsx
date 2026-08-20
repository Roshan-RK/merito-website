"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import { getCriteriaStatusColor, type CriteriaMatchStatus } from "@/lib/criteriaStatus";
import ParameterScoreTile from "./ParameterScoreTile";
import SkillReportTable from "./SkillReportTable";
import CriteriaMatchCard from "./CriteriaMatchCard";
import InterviewRoadmap from "./InterviewRoadmap";
import InterviewEvaluatorNotes from "./InterviewEvaluatorNotes";
import AnswerTranscript from "./AnswerTranscript";

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";
const CARD = "bg-[#141416] border border-white/[0.08]";

// report.strengths/areasOfImprovement arrive as a single "- point\n- point"
// string (IntervueBox's own format), not an array like the fitment report's
// strongPoints/weakPoints -- split so both render bullet lists the same way.
function splitBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

// Same light->dark remap as CriteriaMatchCard.tsx -- kept local rather than
// exported since it's a 3-line table, not worth widening either file's props.
const DARK_STATUS_COLOR: Record<string, string> = {
  "#16803c": "#3FCB8C",
  "#d97706": "#BD7E12",
  "#ed1a24": "#E8798F",
};
function statusColorDark(status: CriteriaMatchStatus): string {
  return DARK_STATUS_COLOR[getCriteriaStatusColor(status)] ?? getCriteriaStatusColor(status);
}

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "growth", label: "Strengths & growth" },
  { id: "coaching", label: "Coaching plan" },
  { id: "conduct", label: "Practice conduct" },
  { id: "qa", label: "Q&A" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function InterviewTabs({ report }: { report: InterviewReportReady }) {
  const [active, setActive] = useState<TabId>("summary");
  const baseId = useId();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Standard WAI-ARIA tabs keyboard pattern: Left/Right (and Home/End) move
  // both focus and selection between triggers -- the mockup's tabs had no
  // keyboard handling at all beyond native Tab-key focus.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex == null) return;
    e.preventDefault();
    const next = TABS[nextIndex];
    setActive(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const skillReportEntries = Object.entries(report.skillReport);
  const strengths = report.strengths ? splitBullets(report.strengths) : [];
  const areasOfImprovement = report.areasOfImprovement ? splitBullets(report.areasOfImprovement) : [];
  const opportunities = report.opportunities ? splitBullets(report.opportunities) : [];
  const threats = report.threats ? splitBullets(report.threats) : [];
  const hasSwot = opportunities.length > 0 || threats.length > 0;
  const hasCoachingContent = Boolean(
    report.feedbackToInterviewer || report.roadmap || report.whatToFocusOnNext || report.trainingFocus
  );
  const hasConductDetail = Boolean(
    report.confidenceLevel || report.presentation || report.bodyLanguage || report.environmentCheck || report.responseQuality
  );

  return (
    <div>
      <div role="tablist" aria-label="Interview report sections" className="flex flex-wrap bg-white/[0.04]" style={{ gap: 4, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {TABS.map((tab, i) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={
                selected
                  ? "bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-semibold"
                  : "text-white/55 hover:text-white font-[family-name:var(--font-poppins)] font-semibold transition-colors"
              }
              style={{ fontSize: 12.5, borderRadius: 9, padding: "7px 14px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {active === "summary" && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-summary`}
          aria-labelledby={`${baseId}-tab-summary`}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {skillReportEntries.length > 0 ? (
            <SkillReportTable skillReport={report.skillReport} />
          ) : (
            <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 13, margin: 0 }}>
              No per-skill breakdown is available for this interview.
            </p>
          )}

          {Object.keys(report.skillMetrics ?? {}).length > 0 && (
            <div className={CARD} style={{ borderRadius: 14, padding: 20 }}>
              <p className={EYEBROW} style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 12px" }}>
                Evaluation parameters
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 12 }}>
                {Object.entries(report.skillMetrics).map(([skill, score]) => (
                  <ParameterScoreTile key={skill} skill={skill} score={score} />
                ))}
              </div>
            </div>
          )}

          {typeof report.skillMetrics?.criteriaMatch === "number" && (
            <CriteriaMatchCard criteriaMatchScore={report.skillMetrics.criteriaMatch} criteriaEvaluationTable={report.criteriaEvaluationTable} />
          )}

          {report.criteriaEvaluationTable.length > 0 && (
            <div className={CARD} style={{ borderRadius: 14, padding: 20 }}>
              <p className={EYEBROW} style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 14px" }}>
                Skill-wise evaluation
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {report.criteriaEvaluationTable.map((entry, i) => (
                  <div key={i} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.08)" : undefined, paddingTop: i > 0 ? 14 : 0 }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6, gap: 10 }}>
                      <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.02rem", margin: 0 }}>
                        {entry.criteria}
                      </h3>
                      <span
                        className="font-[family-name:var(--font-poppins)] font-semibold uppercase"
                        style={{ fontSize: 10.5, letterSpacing: "0.04em", color: statusColorDark(entry.status) }}
                      >
                        {entry.status}
                      </span>
                    </div>
                    <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                      {entry.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: "rgba(237,26,36,0.06)", border: "1px solid rgba(237,26,36,0.2)", borderRadius: 14, padding: 16 }}>
            <p className={EYEBROW} style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
              AI overview
            </p>
            <p className="font-[family-name:var(--font-poppins)] text-white/75" style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>
              {report.overallSummary}
            </p>
          </div>
        </div>
      )}

      {active === "growth" && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-growth`}
          aria-labelledby={`${baseId}-tab-growth`}
          className="grid grid-cols-1 sm:grid-cols-2"
          style={{ gap: 12 }}
        >
          <div style={{ background: "rgba(63,203,140,0.08)", border: "1px solid rgba(63,203,140,0.2)", borderRadius: 14, padding: 16 }}>
            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#3FCB8C]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Strengths
            </p>
            {strengths.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {strengths.map((point, i) => (
                  <p key={i} className="font-[family-name:var(--font-poppins)] text-white/75" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    {point}
                  </p>
                ))}
              </div>
            ) : (
              <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12.5, margin: 0 }}>
                No strengths were captured for this interview.
              </p>
            )}
          </div>

          <div style={{ background: "rgba(189,126,18,0.08)", border: "1px solid rgba(189,126,18,0.22)", borderRadius: 14, padding: 16 }}>
            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#BD7E12]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Areas to improve
            </p>
            {areasOfImprovement.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {areasOfImprovement.map((point, i) => (
                  <p key={i} className="font-[family-name:var(--font-poppins)] text-white/75" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    {point}
                  </p>
                ))}
              </div>
            ) : (
              <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12.5, margin: 0 }}>
                No growth areas were captured for this interview.
              </p>
            )}
          </div>

          {hasSwot && (
            <>
              <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.22)", borderRadius: 14, padding: 16 }}>
                <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#5B9DF5]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
                  Opportunities
                </p>
                {opportunities.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {opportunities.map((point, i) => (
                      <p key={i} className="font-[family-name:var(--font-poppins)] text-white/75" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                        {point}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12.5, margin: 0 }}>
                    No opportunities were captured for this interview.
                  </p>
                )}
              </div>

              <div style={{ background: "rgba(232,121,143,0.08)", border: "1px solid rgba(232,121,143,0.25)", borderRadius: 14, padding: 16 }}>
                <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#E8798F]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
                  Threats
                </p>
                {threats.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {threats.map((point, i) => (
                      <p key={i} className="font-[family-name:var(--font-poppins)] text-white/75" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                        {point}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12.5, margin: 0 }}>
                    No threats were captured for this interview.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {active === "coaching" && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-coaching`}
          aria-labelledby={`${baseId}-tab-coaching`}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {hasCoachingContent ? (
            <>
              {report.whatToFocusOnNext && (
                <div style={{ background: "rgba(237,26,36,0.06)", border: "1px solid rgba(237,26,36,0.2)", borderRadius: 14, padding: 16 }}>
                  <p className={EYEBROW} style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
                    What to focus on next
                  </p>
                  <p className="font-[family-name:var(--font-poppins)] text-white/75" style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>
                    {report.whatToFocusOnNext}
                  </p>
                </div>
              )}
              {report.feedbackToInterviewer && (
                <div className={CARD} style={{ borderRadius: 14, padding: 20 }}>
                  <p className={EYEBROW} style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 14px" }}>
                    Evaluator notes for hiring teams
                  </p>
                  <InterviewEvaluatorNotes notes={report.feedbackToInterviewer} />
                </div>
              )}
              {report.trainingFocus && (
                <div className={CARD} style={{ borderRadius: 14, padding: 20 }}>
                  <p className={EYEBROW} style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
                    Training focus
                  </p>
                  <p className="font-[family-name:var(--font-poppins)] text-white/75" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    {report.trainingFocus}
                  </p>
                </div>
              )}
              {report.roadmap && (
                <div>
                  <p className={EYEBROW} style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 10px" }}>
                    Improvement roadmap
                  </p>
                  <InterviewRoadmap roadmap={report.roadmap} />
                </div>
              )}
            </>
          ) : (
            <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 13, margin: 0 }}>
              No coaching plan was generated for this interview.
            </p>
          )}
        </div>
      )}

      {active === "conduct" && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-conduct`}
          aria-labelledby={`${baseId}-tab-conduct`}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div
            style={{
              background: report.flagForSuspiciousActivity ? "rgba(232,121,143,0.08)" : "rgba(63,203,140,0.08)",
              border: `1px solid ${report.flagForSuspiciousActivity ? "rgba(232,121,143,0.25)" : "rgba(63,203,140,0.25)"}`,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <p
              className="font-[family-name:var(--font-poppins)] font-bold uppercase"
              style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 8px", color: report.flagForSuspiciousActivity ? "#E8798F" : "#3FCB8C" }}
            >
              Integrity assessment · {report.flagForSuspiciousActivity ? "Flagged" : "No issues"}
            </p>
            <p className="font-[family-name:var(--font-poppins)] text-white/75" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              {report.integrityCheck ||
                (report.flagForSuspiciousActivity
                  ? "Suspicious activity was flagged during this interview."
                  : "No suspicious activity flagged during this interview.")}
            </p>
          </div>

          {hasConductDetail && (
            <div className={CARD} style={{ borderRadius: 14, padding: 20 }}>
              <p className={EYEBROW} style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 14px" }}>
                How you came across on camera
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Response quality", value: report.responseQuality },
                  { label: "Confidence", value: report.confidenceLevel },
                  { label: "Presentation", value: report.presentation },
                  { label: "Body language", value: report.bodyLanguage },
                  { label: "Environment", value: report.environmentCheck },
                ]
                  .filter((row): row is { label: string; value: string } => Boolean(row.value))
                  .map((row) => (
                    <p key={row.label} className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                      <span className="font-semibold text-white">{row.label}: </span>
                      <span className="text-white/60">{row.value}</span>
                    </p>
                  ))}
              </div>
            </div>
          )}

          {report.videoReport ? (
            <div className={CARD} style={{ borderRadius: 14, padding: 20 }}>
              <p className={EYEBROW} style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
                Video &amp; delivery notes
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-white/75" style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
                {report.videoReport}
              </p>
            </div>
          ) : (
            !hasConductDetail && (
              <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 13, margin: 0 }}>
                No delivery notes were captured for this interview.
              </p>
            )
          )}
        </div>
      )}

      {active === "qa" && (
        <div role="tabpanel" id={`${baseId}-panel-qa`} aria-labelledby={`${baseId}-tab-qa`}>
          <AnswerTranscript answers={report.answers} />
        </div>
      )}
    </div>
  );
}
