"use client";

import { useState } from "react";
import type { InterviewStatus, PersonalityStatus } from "./ProgressRail";
import ReportSectionPicker from "./ReportSectionPicker";
import { type InterviewSection, type ReportType } from "./reportSections";
import { buildLinkedInCaption, type ShareSection } from "@/lib/linkedinShare";
import { getAbsoluteUrl } from "@/lib/site";

const DEFAULT_SHARE_INTERVIEW_SECTIONS = new Set<InterviewSection>([
  "scoreGauge",
  "overview",
  "skillReport",
  "criteriaMatch",
  "skillEvaluation",
  "strengths",
  "roadmap",
]);

export default function ShareLinkedInModal({
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
  const [step, setStep] = useState<"pick" | "share">("pick");
  const [selected, setSelected] = useState<Set<ReportType>>(new Set());
  const [interviewSections, setInterviewSections] = useState<Set<InterviewSection>>(
    new Set(DEFAULT_SHARE_INTERVIEW_SECTIONS)
  );
  const [copied, setCopied] = useState(false);

  const toggle = (type: ReportType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleSection = (key: InterviewSection) => {
    setInterviewSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canGenerate = selected.size > 0;

  const params = new URLSearchParams();
  params.set("include", Array.from(selected).join(","));
  params.set("role", roleTitle);
  const downloadHref = `/api/hub/export/share-summary?${params.toString()}`;

  const caption = buildLinkedInCaption({
    roleTitle,
    sections: Array.from(selected) as ShareSection[],
    hubUrl: getAbsoluteUrl("/hub"),
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white"
        style={{ maxWidth: 480, width: "100%", borderRadius: 24, padding: 28, position: "relative", maxHeight: "90vh", overflowY: "auto" }}
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
          Share on LinkedIn
        </span>

        {step === "pick" && (
          <>
            <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
              Pick what to include
            </h2>
            <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
              This goes public on LinkedIn — pick which completed assessments to show. Raw scores, the AI recommendation, and the integrity assessment are never included.
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

            <button
              disabled={!canGenerate}
              onClick={() => canGenerate && setStep("share")}
              className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
              style={{
                height: 50,
                borderRadius: 8,
                fontSize: 15,
                background: canGenerate ? "#ed1a24" : "#dcdcdc",
                border: "none",
                marginTop: 16,
                cursor: canGenerate ? "pointer" : "default",
                boxShadow: canGenerate ? "0 4px 6px rgba(236,34,40,0.3)" : "none",
              }}
            >
              Continue
            </button>
          </>
        )}

        {step === "share" && (
          <>
            <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
              Ready to share
            </h2>

            <a
              href={downloadHref}
              download
              className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
              style={{
                display: "block",
                textAlign: "center",
                height: 46,
                lineHeight: "46px",
                borderRadius: 8,
                fontSize: 14,
                background: "#ed1a24",
                marginBottom: 16,
              }}
            >
              1. Download your verified profile PDF
            </a>

            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
              2. Copy the suggested caption
            </p>
            <textarea
              readOnly
              value={caption}
              rows={6}
              className="font-[family-name:var(--font-poppins)] text-black"
              style={{ width: "100%", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.6, resize: "none", marginBottom: 8 }}
            />
            <button
              onClick={handleCopy}
              className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
              style={{ background: "none", border: "1px solid rgba(237,26,36,0.4)", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", marginBottom: 20 }}
            >
              {copied ? "Copied!" : "Copy caption"}
            </button>

            <a
              href="https://www.linkedin.com/feed/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
              style={{
                display: "block",
                textAlign: "center",
                height: 46,
                lineHeight: "46px",
                borderRadius: 8,
                fontSize: 14,
                background: "#0a66c2",
                marginBottom: 12,
              }}
            >
              3. Open LinkedIn
            </a>
            <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11.5, lineHeight: 1.6, margin: 0 }}>
              On LinkedIn: start a post, paste the caption, click &ldquo;Add a document&rdquo; and upload the PDF you just downloaded.
            </p>

            <button
              onClick={() => setStep("pick")}
              className="font-[family-name:var(--font-poppins)] font-semibold text-[#9c9c9c]"
              style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, cursor: "pointer", marginTop: 16 }}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
