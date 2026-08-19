"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

// Renders for fitment_interviews.status === "terminated" -- the candidate's
// session ended before it finished. No payment gate: resuming is a free
// vendor reinvite (mode: RESUME), same class of action as the existing
// admin free-resend.
export default function InterviewTerminatedState({ roleTitle }: { roleTitle: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResume() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/interview/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't resume this interview. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't resume this interview. Please try again.");
      setLoading(false);
    }
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
      <div className="flex items-start bg-white/[0.04]" style={{ gap: 10, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <p className="font-[family-name:var(--font-poppins)] text-white/60" style={{ fontSize: 13, lineHeight: 1.65, margin: 0 }}>
          Your session for {roleTitle} ended before it finished. Your progress is saved — resume whenever you&apos;re ready.
        </p>
      </div>
      <button
        onClick={handleResume}
        disabled={loading}
        className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors disabled:opacity-60"
        style={{ gap: 8, height: 44, padding: "0 20px", borderRadius: 8, fontSize: 14, border: "none", cursor: loading ? "default" : "pointer" }}
      >
        <RotateCcw size={15} strokeWidth={2} />
        {loading ? "Resuming…" : "Resume Interview"}
      </button>
      {error && (
        <p className="font-[family-name:var(--font-poppins)]" style={{ color: "#E8798F", fontSize: 12.5, margin: "10px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}
