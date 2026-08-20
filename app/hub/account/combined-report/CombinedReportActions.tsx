"use client";

import { useState } from "react";
import { Eye, Download, Copy, Check } from "lucide-react";
import ExportPreviewModal from "../ExportPreviewModal";

// Copy-link and Share-on-LinkedIn both need a live share URL first, which
// means a client-side fetch to the existing /api/hub/share endpoint (the
// same one that already backs the report/references "share" flows) --
// Preview lives here too (rather than the standalone ExportPreviewButton
// used elsewhere) purely to match this row's pill-button styling; Download
// has no state of its own but joins this group so the four actions render
// in one consistent order instead of splitting across the server/client
// boundary.
export default function CombinedReportActions({
  roleTitle,
  include,
  interviewSections,
  exportUrl,
}: {
  roleTitle: string;
  include: string;
  interviewSections: string;
  exportUrl: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"copy" | "linkedin" | null>(null);
  const [error, setError] = useState(false);

  const getShareUrl = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/hub/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleTitle, include, interviewSections }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) return null;
      return data.url as string;
    } catch {
      return null;
    }
  };

  const handleCopy = async () => {
    setBusy("copy");
    setError(false);
    const url = await getShareUrl();
    setBusy(null);
    if (!url) {
      setError(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard permissions can fail silently in some browsers/contexts —
      // the link itself was still created successfully, so don't surface
      // this as an error state.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLinkedIn = async () => {
    setBusy("linkedin");
    setError(false);
    const url = await getShareUrl();
    setBusy(null);
    if (!url) {
      setError(true);
      return;
    }
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
  };

  const buttonClass =
    "flex items-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white disabled:opacity-50";
  const buttonStyle = { gap: 6, fontSize: 12.5, borderRadius: 50, padding: "7px 14px", border: "1px solid rgba(255,255,255,0.08)" };

  return (
    <>
      <button type="button" onClick={() => setPreviewOpen(true)} className={buttonClass} style={buttonStyle}>
        <Eye size={13} strokeWidth={2} /> Preview
      </button>
      <a href={exportUrl} download className={buttonClass} style={buttonStyle}>
        <Download size={13} strokeWidth={2} /> Download
      </a>
      <button type="button" onClick={handleCopy} disabled={busy !== null} className={buttonClass} style={buttonStyle}>
        {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={2} />}
        {copied ? "Link copied" : busy === "copy" ? "Copying…" : "Copy live link"}
      </button>
      <button type="button" onClick={handleLinkedIn} disabled={busy !== null} className={buttonClass} style={buttonStyle}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.11 20.45H3.56V9h3.55v11.45z" />
        </svg>
        {busy === "linkedin" ? "Preparing…" : "Share on LinkedIn"}
      </button>
      {error && (
        <span className="w-full font-[family-name:var(--font-poppins)] text-[#ed1a24]" style={{ fontSize: 11.5 }}>
          Couldn&apos;t create a share link. Please try again.
        </span>
      )}
      {previewOpen && (
        <ExportPreviewModal
          title="Consolidated report: export preview"
          exportUrl={exportUrl}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
