"use client";

import { useState } from "react";
import type { InterviewStatus, PersonalityStatus } from "./ProgressRail";
import ReportSectionPicker from "./ReportSectionPicker";
import { INTERVIEW_SECTIONS, type InterviewSection, type ReportType } from "./reportSections";

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
  const [selected, setSelected] = useState<Set<ReportType>>(new Set());
  const [interviewSections, setInterviewSections] = useState<Set<InterviewSection>>(
    new Set(DEFAULT_INTERVIEW_SECTIONS)
  );

  const toggleSection = (key: InterviewSection) => {
    setInterviewSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggle = (type: ReportType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
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

        <ReportSectionPicker
          reportUnlocked={reportUnlocked}
          personalityStatus={personalityStatus}
          interviewStatus={interviewStatus}
          referenceCheckStatus={referenceCheckStatus}
          selected={selected}
          onToggle={toggle}
          interviewSections={interviewSections}
          onToggleInterviewSection={toggleSection}
        />

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
