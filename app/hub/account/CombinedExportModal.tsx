"use client";

import { useState } from "react";
import type { InterviewStatus, PersonalityStatus } from "./ProgressRail";

type ReportType = "fitment" | "personality" | "interview" | "references";

type InterviewSection =
  | "scoreGauge"
  | "overview"
  | "skillReport"
  | "criteriaMatch"
  | "skillEvaluation"
  | "strengths"
  | "integrity"
  | "recommendation"
  | "roadmap";

const INTERVIEW_SECTIONS: { key: InterviewSection; label: string }[] = [
  { key: "scoreGauge", label: "Score & delivery parameters" },
  { key: "overview", label: "AI overview summary" },
  { key: "skillReport", label: "Skill-wise score table" },
  { key: "criteriaMatch", label: "Criteria match summary" },
  { key: "skillEvaluation", label: "Skill-wise evaluation detail" },
  { key: "strengths", label: "What the interview evidenced" },
  { key: "integrity", label: "Integrity assessment" },
  { key: "recommendation", label: "AI recommendation (blunt hire/no-hire verdict)" },
  { key: "roadmap", label: "Improvement roadmap" },
];

const DEFAULT_INTERVIEW_SECTIONS = new Set<InterviewSection>(
  INTERVIEW_SECTIONS.map((s) => s.key).filter((k) => k !== "recommendation")
);

export default function CombinedExportModal({
  roleTitle,
  reportUnlocked,
  personalityStatus,
  interviewStatus,
  referenceCheckStatus,
  onClose,
}: {
  roleTitle: string;
  reportUnlocked: boolean;
  personalityStatus: PersonalityStatus;
  interviewStatus: InterviewStatus;
  referenceCheckStatus: "none" | "in_progress" | "completed";
  onClose: () => void;
}) {
  const availability: Record<ReportType, boolean> = {
    fitment: reportUnlocked,
    personality: personalityStatus === "ready",
    interview: interviewStatus === "ready",
    references: referenceCheckStatus === "completed",
  };

  const [selected, setSelected] = useState<Set<ReportType>>(new Set());
  const [interviewSections, setInterviewSections] = useState<Set<InterviewSection>>(
    new Set(DEFAULT_INTERVIEW_SECTIONS)
  );
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const toggleSection = (key: InterviewSection) => {
    setInterviewSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggle = (type: ReportType) => {
    if (!availability[type]) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const labels: Record<ReportType, string> = {
    fitment: "Fitment report",
    personality: "Personality report",
    interview: "AI interview report",
    references: "Reference check report",
  };

  const canGenerate = selected.size > 0;
  const params = new URLSearchParams();
  params.set("include", Array.from(selected).join(","));
  params.set("role", roleTitle);
  if (selected.has("interview")) {
    params.set("interviewSections", Array.from(interviewSections).join(","));
  }
  const href = `/api/hub/export/combined?${params.toString()}`;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white"
        style={{ maxWidth: 480, width: "100%", borderRadius: 24, padding: 28, position: "relative" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9c9c9c" }}
        >
          ✕
        </button>

        <span
          className="bg-[#fdeced] text-[#ed1a24] font-[family-name:var(--font-poppins)] font-bold"
          style={{ fontSize: 11, borderRadius: 50, padding: "4px 12px", display: "inline-block", marginBottom: 12 }}
        >
          Combined export
        </span>
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
          Pick what to include
        </h2>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
          Choose one or more completed reports to combine into a single PDF.
        </p>

        {(Object.keys(labels) as ReportType[]).map((type) => (
          <div key={type}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 4px",
                opacity: availability[type] ? 1 : 0.45,
                cursor: availability[type] ? "pointer" : "default",
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(type)}
                disabled={!availability[type]}
                onChange={() => toggle(type)}
              />
              <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14 }}>
                {labels[type]}
                {!availability[type] && (
                  <span style={{ color: "#9c9c9c", fontSize: 12 }}> — not completed yet</span>
                )}
              </span>
            </label>
            {type === "interview" && availability.interview && selected.has("interview") && (
              <div style={{ padding: "0 4px 8px 30px" }}>
                <button
                  type="button"
                  onClick={() => setCustomizeOpen((v) => !v)}
                  className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
                  style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, cursor: "pointer" }}
                >
                  Customize sections {customizeOpen ? "▲" : "▼"}
                </button>
                {customizeOpen && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                    {INTERVIEW_SECTIONS.map((section) => (
                      <label
                        key={section.key}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          checked={interviewSections.has(section.key)}
                          onChange={() => toggleSection(section.key)}
                        />
                        <span className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12.5 }}>
                          {section.label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {canGenerate ? (
          <a
            href={href}
            download
            className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{
              display: "block",
              textAlign: "center",
              height: 50,
              lineHeight: "50px",
              borderRadius: 8,
              fontSize: 15,
              background: "#ed1a24",
              marginTop: 16,
              boxShadow: "0 4px 6px rgba(236,34,40,0.3)",
            }}
            onClick={onClose}
          >
            Generate combined PDF
          </a>
        ) : (
          <button
            disabled
            className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ height: 50, borderRadius: 8, fontSize: 15, background: "#dcdcdc", border: "none", marginTop: 16, cursor: "default" }}
          >
            Generate combined PDF
          </button>
        )}
      </div>
    </div>
  );
}
