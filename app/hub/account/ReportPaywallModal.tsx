"use client";

import { useState } from "react";

export default function ReportPaywallModal({
  roleTitle,
  onClose,
  onUnlocked,
}: {
  roleTitle: string;
  onClose: () => void;
  onUnlocked: (report: { strengths: string[]; gaps: string[]; cvFixes: string[] }) => void;
}) {
  const [paying, setPaying] = useState(false);
  const [needsCv, setNeedsCv] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/unlock-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaying(false);
        setError(data.error || "Something went wrong — please try again.");
        return;
      }
      if (data.status === "needs_cv") {
        setPaying(false);
        setNeedsCv(true);
        return;
      }
      setPaying(false);
      onUnlocked(data.report);
    } catch {
      setPaying(false);
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
        style={{ maxWidth: 520, width: "100%", borderRadius: 24, padding: 28, position: "relative", maxHeight: "92vh", overflowY: "auto" }}
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
          Detailed Report
        </span>
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
          See exactly why you scored what you scored
        </h2>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>
          Your strengths, your gaps, and exactly how to fix your CV for {roleTitle}.
        </p>

        {needsCv ? (
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            Report unlocked — but we need your CV to generate it. Head back to the HUB and re-run a fitment check for this role, then return here.
          </p>
        ) : (
          <>
            <div className="bg-[#fdf8fb]" style={{ borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <span
                className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c] bg-white border border-[#dcdcdc]"
                style={{ fontSize: 9, letterSpacing: "0.06em", borderRadius: 50, padding: "3px 9px" }}
              >
                Sample
              </span>
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
                ✓ Strong product sense across 3 launches
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                ✓ 5+ years B2B SaaS experience
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                ░░░░░░░░░░░░░░░░░░░░ (unlock for full breakdown)
              </p>
            </div>

            <button
              onClick={handlePay}
              disabled={paying}
              className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
              style={{ height: 50, borderRadius: 8, fontSize: 15, background: paying ? "#dcdcdc" : "#ed1a24", border: "none", cursor: paying ? "default" : "pointer", boxShadow: paying ? "none" : "0 4px 6px rgba(236,34,40,0.3)" }}
            >
              {paying ? "Unlocking…" : "Unlock full report — ₹299"}
            </button>
            <p className="text-[#9c9c9c]" style={{ fontSize: 11.5, textAlign: "center", margin: "10px 0 0" }}>
              One-time payment · No subscription · UPI, card & netbanking
            </p>
          </>
        )}

        {error && (
          <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>{error}</p>
        )}
      </div>
    </div>
  );
}
