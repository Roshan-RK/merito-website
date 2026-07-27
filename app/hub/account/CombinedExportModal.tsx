"use client";

import { useState } from "react";
import type { InterviewStatus, PersonalityStatus } from "./ProgressRail";

type ReportType = "fitment" | "personality" | "interview" | "references";

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
  const href = `/api/hub/export/combined?include=${Array.from(selected).join(",")}&role=${encodeURIComponent(roleTitle)}`;

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
          <label
            key={type}
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
