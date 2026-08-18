"use client";

import { useState } from "react";

// Shows exactly what the downloadable PDF will look like by iframe-embedding
// the same export API route (/api/hub/report/export, /api/hub/references/export)
// that already screenshots the live dashboard page via headless Chromium
// (lib/pdf/renderPageToPdf.ts). This intentionally does not re-render the
// report/reference layout a second time -- the iframe loads the literal PDF
// bytes the download link would save, so the preview can never drift from
// the real export. No download action here -- Chrome's native PDF viewer
// (rendering the iframed PDF) already has its own download button.
export default function ExportPreviewModal({
  title,
  exportUrl,
  onClose,
}: {
  title: string;
  exportUrl: string;
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9c9c9c", lineHeight: 1 }}
          >
            ✕
          </button>
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
            src={`${exportUrl}${exportUrl.includes("?") ? "&" : "?"}inline=1`}
            title={`${title} preview`}
            onLoad={() => setLoaded(true)}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      </div>
    </div>
  );
}
