"use client";

import Link from "next/link";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";

export default function ScoreCard({
  roleTitle,
  score,
  prevScore,
  verdict,
  reportUnlocked,
  report,
  onOpenReportPaywall,
}: {
  roleTitle: string;
  score: number;
  prevScore: number | null;
  verdict: string;
  reportUnlocked: boolean;
  report: FitmentReportResult | null;
  onOpenReportPaywall: () => void;
}) {
  const delta = prevScore !== null ? Math.round((score - prevScore) * 10) / 10 : null;
  const allRequirements = report ? report.categories.flatMap((c) => c.requirements) : [];
  const topStrong = allRequirements.find((r) => r.matchLevel === "strong");
  const topMissing = allRequirements.find((r) => r.matchLevel === "missing");

  return (
    <div
      className="bg-white border border-black/[0.08]"
      style={{ borderRadius: 20, padding: 24, boxShadow: "0 18px 50px rgba(17,35,89,0.05)" }}
    >
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <span
          className="rounded-full bg-[#ed1a24] inline-block"
          style={{ width: 8, height: 8 }}
        />
        <span className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#4b4b4d]" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
          Your Job Fitment Score
        </span>
        <span
          className="bg-[#eefdf1] text-[#16803c] font-[family-name:var(--font-poppins)] font-bold"
          style={{ fontSize: 10, borderRadius: 50, padding: "3px 9px", marginLeft: "auto" }}
        >
          ✓ Step 1 complete
        </span>
      </div>

      <div className="flex items-baseline flex-wrap" style={{ gap: 10 }}>
        <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "3.2rem", lineHeight: 1, whiteSpace: "nowrap" }}>
          {score.toFixed(1)}<span className="font-semibold text-[#9c9c9c]" style={{ fontSize: "1.2rem" }}> / 10</span>
        </span>
        {delta !== null && delta !== 0 && (
          <span
            className={delta > 0 ? "bg-[#eefdf1] text-[#16803c]" : "bg-[#fdeced] text-[#ed1a24]"}
            style={{ fontSize: 12, fontWeight: 700, borderRadius: 50, padding: "4px 10px" }}
          >
            {delta > 0 ? "↑" : "↓"} was {prevScore?.toFixed(1)}
          </span>
        )}
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13, marginLeft: "auto" }}>
          fit for {roleTitle}
        </span>
      </div>

      <div className="bg-[#f0e6ea] overflow-hidden" style={{ marginTop: 12, height: 12, borderRadius: 6 }}>
        <div className="bg-[#ed1a24] h-full" style={{ borderRadius: 6, width: `${score * 10}%` }} />
      </div>

      <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: "12px 0 0" }}>
        {verdict}
      </p>

      {!reportUnlocked ? (
        <>
          <button
            onClick={onOpenReportPaywall}
            className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ marginTop: 18, height: 48, borderRadius: 8, fontSize: 14, background: "#ed1a24", border: "none", cursor: "pointer", boxShadow: "0 4px 6px rgba(236,34,40,0.3)" }}
          >
            🔒 See my detailed report
          </button>
          <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "10px 0 0", lineHeight: 1.6 }}>
            Why {score.toFixed(1)}? Your strengths, your gaps, and how to fix your CV — ₹299
          </p>
        </>
      ) : report ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topStrong && (
              <div
                className="bg-[#eefdf1]"
                style={{ borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  className="bg-[#16803c] text-white font-[family-name:var(--font-poppins)] font-bold"
                  style={{ borderRadius: 50, padding: "2px 8px", fontSize: 10 }}
                >
                  Strong
                </span>
                <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5 }}>
                  {topStrong.requirement}
                </span>
              </div>
            )}
            {topMissing && (
              <div
                className="bg-[#fdeced]"
                style={{ borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  className="bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold"
                  style={{ borderRadius: 50, padding: "2px 8px", fontSize: 10 }}
                >
                  Missing
                </span>
                <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5 }}>
                  {topMissing.requirement}
                </span>
              </div>
            )}
          </div>
          <Link
            href="/hub/account/report"
            className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
            style={{ fontSize: 13, display: "inline-block", marginTop: 12 }}
          >
            Open full report →
          </Link>
        </div>
      ) : (
        <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "18px 0 0" }}>
          Unlocked — your report is generating. Refresh in a moment.
        </p>
      )}
    </div>
  );
}
