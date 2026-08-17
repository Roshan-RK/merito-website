"use client";

import { useState } from "react";
import { Download } from "lucide-react";

// Shows exactly what the downloadable PDF will look like by iframe-embedding
// the same export API route (/api/hub/report/export, /api/hub/references/export)
// that already screenshots the live dashboard page via headless Chromium
// (lib/pdf/renderPageToPdf.ts). This intentionally does not re-render the
// report/reference layout a second time -- the iframe loads the literal PDF
// bytes the "Download PDF" link would save, so the preview can never drift
// from the real export.
export default function ExportPreviewModal({
  title,
  exportUrl,
  downloadFilename,
  onClose,
}: {
  title: string;
  exportUrl: string;
  downloadFilename: string;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white"
        style={{
          maxWidth: 880,
          width: "100%",
          height: "90vh",
          borderRadius: 24,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          className="flex items-center justify-between flex-wrap"
          style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,0,0,0.08)", gap: 12 }}
        >
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.1rem", margin: 0 }}>
            {title}
          </h2>
          <div className="flex items-center" style={{ gap: 10 }}>
            <a
              href={exportUrl}
              download={downloadFilename}
              className="flex items-center bg-[#ed1a24] hover:bg-[#d3141d] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white"
              style={{ gap: 6, fontSize: 12.5, borderRadius: 50, padding: "8px 16px" }}
            >
              <Download size={13} strokeWidth={2} /> Download PDF
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9c9c9c", lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ flex: 1, position: "relative", background: "#f4f1f7" }}>
          {!loaded && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13 }}>
                Generating preview…
              </p>
            </div>
          )}
          <iframe
            src={exportUrl}
            title={`${title} preview`}
            onLoad={() => setLoaded(true)}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      </div>
    </div>
  );
}
