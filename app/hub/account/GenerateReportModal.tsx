"use client";

import { useEffect, useState } from "react";
import type { InterviewStatus, PersonalityStatus } from "./ProgressRail";
import ReportSectionPicker from "./ReportSectionPicker";
import { INTERVIEW_SECTIONS, type InterviewSection, type ReportType } from "./reportSections";
import { buildLinkedInCaption, type ShareSection } from "@/lib/linkedinShare";
import { getAbsoluteUrl } from "@/lib/site";

const DEFAULT_INTERVIEW_SECTIONS = new Set<InterviewSection>(
  INTERVIEW_SECTIONS.map((s) => s.key).filter((k) => k !== "recommendation" && k !== "integrity")
);

export default function GenerateReportModal({
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
  const [step, setStep] = useState<"pick" | "output">("pick");
  const [selected, setSelected] = useState<Set<ReportType>>(new Set());
  const [interviewSections, setInterviewSections] = useState<Set<InterviewSection>>(
    new Set(DEFAULT_INTERVIEW_SECTIONS)
  );
  const [linkCopied, setLinkCopied] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareRevoked, setShareRevoked] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    if (step !== "output") return;
    let cancelled = false;
    fetch(`/api/hub/share?role=${encodeURIComponent(roleTitle)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.url) return;
        setShareUrl(data.url);
        setShareRevoked(Boolean(data.revoked));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [step, roleTitle]);

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
  if (selected.has("interview")) {
    params.set("interviewSections", Array.from(interviewSections).join(","));
  }
  const downloadHref = `/api/hub/export/combined?${params.toString()}`;

  const caption = buildLinkedInCaption({
    roleTitle,
    sections: Array.from(selected) as ShareSection[],
    hubUrl: getAbsoluteUrl("/hub"),
  });

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCopyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    setCaptionCopied(true);
    setTimeout(() => setCaptionCopied(false), 2000);
  };

  const handleGenerateLink = async () => {
    setShareLoading(true);
    try {
      const res = await fetch("/api/hub/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleTitle,
          include: Array.from(selected).join(","),
          interviewSections: Array.from(interviewSections).join(","),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShareUrl(data.url);
        setShareRevoked(false);
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleToggleRevoke = async () => {
    const nextRevoked = !shareRevoked;
    setShareRevoked(nextRevoked);
    await fetch("/api/hub/share/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleTitle, revoked: nextRevoked }),
    });
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
          Generate consolidated report
        </span>

        {step === "pick" && (
          <>
            <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
              Pick what to include
            </h2>
            <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
              Choose one or more completed reports. You can download a PDF, get a public link, or share on LinkedIn from the same selection.
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
              onClick={() => canGenerate && setStep("output")}
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

        {step === "output" && (
          <>
            <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
              Ready to go
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
                marginBottom: 20,
              }}
            >
              Download PDF
            </a>

            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
              Public link
            </p>
            {shareUrl ? (
              <>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                  <input
                    readOnly
                    value={shareUrl}
                    className="font-[family-name:var(--font-poppins)] text-black"
                    style={{ flex: 1, minWidth: 0, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }}
                  />
                  <button
                    onClick={handleCopyLink}
                    className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
                    style={{ background: "none", border: "1px solid rgba(237,26,36,0.4)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}
                  >
                    {linkCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <label className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", marginBottom: 20 }}>
                  <input type="checkbox" checked={shareRevoked} onChange={handleToggleRevoke} />
                  Revoke this link (anyone with it loses access)
                </label>
              </>
            ) : (
              <button
                onClick={handleGenerateLink}
                disabled={shareLoading}
                className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
                style={{ width: "100%", background: "none", border: "1px solid rgba(237,26,36,0.4)", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: shareLoading ? "default" : "pointer", marginBottom: 20 }}
              >
                {shareLoading ? "Generating…" : "Get public link"}
              </button>
            )}

            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}>
              Share on LinkedIn
            </p>
            <textarea
              readOnly
              value={caption}
              rows={6}
              className="font-[family-name:var(--font-poppins)] text-black"
              style={{ width: "100%", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.6, resize: "none", marginBottom: 8 }}
            />
            <button
              onClick={handleCopyCaption}
              className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
              style={{ background: "none", border: "1px solid rgba(237,26,36,0.4)", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", marginBottom: 12 }}
            >
              {captionCopied ? "Copied!" : "Copy caption"}
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
              Open LinkedIn
            </a>
            <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11.5, lineHeight: 1.6, margin: 0 }}>
              On LinkedIn: start a post, paste the caption, click &ldquo;Add a document&rdquo; and upload the PDF you downloaded above — or paste the public link instead.
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
