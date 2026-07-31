"use client";

import { useState } from "react";
import type { InterviewStatus, PersonalityStatus } from "./ProgressRail";
import { INTERVIEW_SECTIONS, REPORT_TYPE_LABELS, type InterviewSection, type ReportType } from "./reportSections";

export default function ReportSectionPicker({
  reportUnlocked,
  personalityStatus,
  interviewStatus,
  referenceCheckStatus,
  selected,
  onToggle,
  interviewSections,
  onToggleInterviewSection,
}: {
  reportUnlocked: boolean;
  personalityStatus: PersonalityStatus;
  interviewStatus: InterviewStatus;
  referenceCheckStatus: "none" | "in_progress" | "completed";
  selected: Set<ReportType>;
  onToggle: (type: ReportType) => void;
  interviewSections: Set<InterviewSection>;
  onToggleInterviewSection: (key: InterviewSection) => void;
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const availability: Record<ReportType, boolean> = {
    fitment: reportUnlocked,
    personality: personalityStatus === "ready",
    interview: interviewStatus === "ready",
    references: referenceCheckStatus === "completed",
  };

  return (
    <>
      {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((type) => (
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
              onChange={() => availability[type] && onToggle(type)}
            />
            <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14 }}>
              {REPORT_TYPE_LABELS[type]}
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
                        onChange={() => onToggleInterviewSection(section.key)}
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
    </>
  );
}
