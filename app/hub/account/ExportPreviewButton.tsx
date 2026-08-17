"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import ExportPreviewModal from "./ExportPreviewModal";

// Small client island so report/page.tsx and references/page.tsx (both
// server components) can open a preview modal without themselves becoming
// client components. Only rendered by callers once the panel's real,
// exportable content exists (report: unlocked + READY; references:
// status === "completed") -- see the gating already in those pages.
export default function ExportPreviewButton({
  exportUrl,
  downloadFilename,
  title,
}: {
  exportUrl: string;
  downloadFilename: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white"
        style={{ gap: 6, fontSize: 12.5, borderRadius: 50, padding: "7px 14px", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Eye size={13} strokeWidth={2} /> Preview export format
      </button>
      {open && (
        <ExportPreviewModal
          title={title}
          exportUrl={exportUrl}
          downloadFilename={downloadFilename}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
