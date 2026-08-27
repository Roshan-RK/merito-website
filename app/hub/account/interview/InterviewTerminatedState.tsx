"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import InterviewResumeWarning from "./InterviewResumeWarning";
import { resumeInterview } from "./resumeInterview";

// Renders for fitment_interviews.status === "terminated" -- the candidate's
// session ended before it finished. No payment gate: resuming is a free
// vendor reinvite (mode: RESUME), same class of action as the existing
// admin free-resend.
export default function InterviewTerminatedState({ roleTitle, leadId }: { roleTitle: string; leadId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResume() {
    setLoading(true);
    setError(null);
    const result = await resumeInterview(leadId);
    if (result.ok) {
      window.location.href = result.url;
      return;
    }
    setError(result.error);
    setLoading(false);
  }

  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 24 }}>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 14 }}>
        <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
          <RotateCcw size={17} strokeWidth={2} />
        </div>
        <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem" }}>
          Your interview was interrupted
        </span>
      </div>
      <p className="font-[family-name:var(--font-poppins)] text-white/60" style={{ fontSize: 13, lineHeight: 1.65, margin: "0 0 16px" }}>
        Your session for {roleTitle} ended before it finished. Your progress is saved — resume whenever you&apos;re ready.
      </p>
      <InterviewResumeWarning />
      <button
        type="button"
        onClick={handleResume}
        disabled={loading}
        className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors disabled:opacity-60"
        style={{ gap: 8, height: 44, padding: "0 20px", borderRadius: 8, fontSize: 14, border: "none", cursor: loading ? "default" : "pointer" }}
      >
        <RotateCcw size={15} strokeWidth={2} />
        {loading ? "Resuming…" : "Resume Interview"}
      </button>
      {error && (
        <p role="alert" className="font-[family-name:var(--font-poppins)]" style={{ color: "#E8798F", fontSize: 12.5, margin: "10px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}
