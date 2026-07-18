"use client";

import { useState } from "react";

export default function InterviewStartModal({
  roleTitle,
  onClose,
  onStarted,
}: {
  roleTitle: string;
  onClose: () => void;
  onStarted: (status: "invited" | "ready") => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/start-ai-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStarting(false);
        setError(data.error || "Something went wrong — please try again.");
        return;
      }
      setStarting(false);
      onStarted(data.status === "ready" ? "ready" : "invited");
    } catch {
      setStarting(false);
      setError("Something went wrong — please try again.");
    }
  };

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
          Mock AI Interview
        </span>
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
          Ready for a real AI interview?
        </h2>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
          We&apos;ll send you an email with a link to start your AI interview for {roleTitle}. Complete it whenever
          you&apos;re ready — your report will show up here once it&apos;s done.
        </p>

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ height: 50, borderRadius: 8, fontSize: 15, background: starting ? "#dcdcdc" : "#ed1a24", border: "none", cursor: starting ? "default" : "pointer", boxShadow: starting ? "none" : "0 4px 6px rgba(236,34,40,0.3)" }}
        >
          {starting ? "Sending invite…" : "Send me my interview invite"}
        </button>

        {error && <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>{error}</p>}
      </div>
    </div>
  );
}
