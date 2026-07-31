"use client";

import { useState } from "react";
import type { ReportType } from "../reportSections";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import type { Scores } from "@/lib/personality";
import type { ReferenceReport } from "@/lib/referenceChecks";
import ResumeMatchGauge from "../report/ResumeMatchGauge";
import ResumeMatchCategoryCard from "../report/ResumeMatchCategoryCard";
import CondensedPersonalitySection from "../combined-report/CondensedPersonalitySection";
import InterviewScoreGauge from "../interview/InterviewScoreGauge";
import ParameterScoreTile from "../interview/ParameterScoreTile";
import CriteriaMatchCard from "../interview/CriteriaMatchCard";
import SkillReportTable from "../interview/SkillReportTable";
import RoadmapTimeline from "../RoadmapTimeline";
import { InlineText } from "../EvaluatorNotes";

const SECTION_LABELS: Record<ReportType, string> = {
  fitment: "Fitment report",
  personality: "Personality profile",
  interview: "AI interview report",
  references: "Reference checks",
};

const SELECTABLE_SECTIONS = Object.keys(SECTION_LABELS) as ReportType[];

function splitBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

export default function RecruiterPreviewClient({
  roleTitle,
  candidateName,
  fitment,
  personality,
  interview,
  references,
  initialEnabled,
  initialSections,
}: {
  roleTitle: string | null;
  candidateName: string;
  fitment: ResumeMatchReportReady | null;
  personality: Scores | null;
  interview: InterviewReportReady | null;
  references: ReferenceReport | null;
  initialEnabled: boolean;
  initialSections: string[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [sections, setSections] = useState<Set<ReportType>>(
    new Set(initialSections.filter((s): s is ReportType => (SELECTABLE_SECTIONS as string[]).includes(s)))
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const available: Record<ReportType, boolean> = {
    fitment: fitment !== null,
    personality: personality !== null,
    interview: interview !== null,
    references: references !== null,
  };
  const hasAnyData = fitment !== null || personality !== null || interview !== null || references !== null;

  function toggleSection(section: ReportType) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaveState("saving");
    try {
      const response = await fetch("/api/hub/recruiter-preview", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, sections: Array.from(sections) }),
      });
      setSaveState(response.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }

  if (!hasAnyData) {
    return (
      <main style={{ padding: "48px 20px", maxWidth: 820, margin: "0 auto" }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem" }}>
          Recruiter Preview
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
          Complete at least one report — fitment, personality, AI interview, or reference checks — before you can make
          your profile visible to recruiters.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: "48px 20px", maxWidth: 820, margin: "0 auto" }}>
      <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem" }}>
        Recruiter Preview
      </h1>
      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, margin: "6px 0 24px" }}>
        Control what recruiters see about you via the Merito Hub recruiter preview, before they ever reach out. Raw
        scores, the AI recommendation, and the integrity assessment are never included.
      </p>

      <label className="flex items-center" style={{ gap: 10, marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14 }}>
          Visible to recruiters
        </span>
      </label>

      {enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24, paddingLeft: 4 }}>
          {SELECTABLE_SECTIONS.map((section) => (
            <label
              key={section}
              className="flex items-center"
              style={{ gap: 10, opacity: available[section] ? 1 : 0.4, cursor: available[section] ? "pointer" : "not-allowed" }}
            >
              <input
                type="checkbox"
                checked={sections.has(section)}
                disabled={!available[section]}
                onChange={() => toggleSection(section)}
              />
              <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5 }}>
                {SECTION_LABELS[section]}
                {!available[section] ? " (not available yet)" : ""}
              </span>
            </label>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saveState === "saving"}
        className="font-[family-name:var(--font-poppins)] font-semibold text-white"
        style={{ background: "#ed1a24", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 13.5, cursor: "pointer", marginBottom: 12 }}
      >
        {saveState === "saving" ? "Saving…" : "Save"}
      </button>
      {saveState === "saved" && (
        <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: "#16803c", margin: "0 0 24px" }}>
          Saved.
        </p>
      )}
      {saveState === "error" && (
        <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: "#ed1a24", margin: "0 0 24px" }}>
          Something went wrong saving — please try again.
        </p>
      )}

      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.15rem", margin: "32px 0 4px" }}>
        Live preview
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, margin: "0 0 20px" }}>
        {enabled ? "This is exactly what a recruiter would see." : 'Turn on "Visible to recruiters" to see a preview.'}
      </p>

      {enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {sections.has("fitment") && fitment && (
            <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20 }}>
              <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11.5, margin: "0 0 14px" }}>
                Matched against: <strong className="text-black">{roleTitle}</strong> — JD candidate submitted for this
                report.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 2fr", gap: 20, alignItems: "start" }}>
                <ResumeMatchGauge percent={fitment.overallScore} />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {fitment.categories.map((category) => (
                    <ResumeMatchCategoryCard key={category.key} category={category} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {sections.has("personality") && personality && (
            <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20 }}>
              <CondensedPersonalitySection candidateName={candidateName} scores={personality} />
            </div>
          )}

          {sections.has("interview") && interview && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                className="bg-white border border-black/[0.08]"
                style={{ borderRadius: 14, padding: 20, display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 24, alignItems: "center" }}
              >
                <div>
                  <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 12px" }}>
                    Delivery parameters
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
                    {Object.entries(interview.skillMetrics ?? {}).map(([skill, score]) => (
                      <ParameterScoreTile key={skill} skill={skill} score={score} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <InterviewScoreGauge score={interview.overallScore} />
                </div>
              </div>

              <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20 }}>
                <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
                  AI overview
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>
                  {interview.overallSummary}
                </p>
              </div>

              {Object.keys(interview.skillReport).length > 0 && <SkillReportTable skillReport={interview.skillReport} />}

              {typeof interview.skillMetrics?.criteriaMatch === "number" && (
                <CriteriaMatchCard
                  criteriaMatchScore={interview.skillMetrics.criteriaMatch}
                  criteriaEvaluationTable={interview.criteriaEvaluationTable}
                />
              )}

              {interview.strengths && (
                <div className="bg-[#eefdf1]" style={{ borderRadius: 14, padding: "14px 16px" }}>
                  <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#16803c]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
                    What the interview evidenced
                  </p>
                  <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                    {splitBullets(interview.strengths).map((point, i, arr) => (
                      <span key={i}>
                        <InlineText text={point} />
                        {i < arr.length - 1 ? "; " : ""}
                      </span>
                    ))}
                  </p>
                </div>
              )}

              {interview.roadmap && <RoadmapTimeline roadmap={interview.roadmap} />}
            </div>
          )}

          {sections.has("references") && references && (
            <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20 }}>
              <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
                Reference checks
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, margin: "0 0 12px" }}>
                Overall reference score: <strong>{references.overallScore}/5</strong>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {references.referees.map((r, i) => (
                  <div key={i} style={{ borderTop: i > 0 ? "1px solid rgba(0,0,0,0.08)" : undefined, paddingTop: i > 0 ? 10 : 0 }}>
                    <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: 0 }}>
                      {r.name} — {r.role}
                    </p>
                    {r.overallFeedback && (
                      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12.5, margin: "4px 0 0" }}>
                        {r.overallFeedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
