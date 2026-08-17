"use client";

import Link from "next/link";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";

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
  report: ResumeMatchReportReady | null;
  onOpenReportPaywall: () => void;
}) {
  const delta = prevScore !== null ? Math.round((score - prevScore) * 10) / 10 : null;
  const topStrong = report?.strongPoints[0];
  const topMissing = report?.weakPoints[0];
  const percent = Math.max(0, Math.min(100, (score / 10) * 100));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (percent / 100) * circumference;

  return (
    <div data-tour="score" className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 20, padding: 24 }}>
      <div className="flex items-start flex-wrap" style={{ gap: 24 }}>
        <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
          <svg width="132" height="132" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r={radius} fill="none" stroke="rgba(237,26,36,0.15)" strokeWidth="10" />
            <circle
              cx="66"
              cy="66"
              r={radius}
              fill="none"
              stroke="#ed1a24"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              transform="rotate(-90 66 66)"
              style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.23,1,0.32,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "1.9rem", lineHeight: 1 }}>
              {score.toFixed(1)}
            </span>
            <span className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 11 }}>
              / 10
            </span>
          </div>
        </div>

        <div style={{ minWidth: 240, flex: 1 }}>
          <div className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 8 }}>
            <span className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/45" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
              Job Fitment Score
            </span>
            <span
              className="bg-[#16803c]/20 text-[#4ade80] font-[family-name:var(--font-poppins)] font-bold"
              style={{ fontSize: 10, borderRadius: 50, padding: "3px 9px" }}
            >
              ✓ Step 1 complete
            </span>
            {delta !== null && delta !== 0 && (
              <span
                className={delta > 0 ? "bg-[#16803c]/20 text-[#4ade80]" : "bg-[#ed1a24]/15 text-[#ff6b6f]"}
                style={{ fontSize: 11, fontWeight: 700, borderRadius: 50, padding: "3px 9px" }}
              >
                {delta > 0 ? "↑" : "↓"} was {prevScore?.toFixed(1)}
              </span>
            )}
          </div>

          <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 15, margin: "0 0 6px" }}>
            {roleTitle}
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            {verdict}
          </p>
        </div>
      </div>

      <div className="bg-white/[0.06] overflow-hidden" style={{ marginTop: 18, height: 10, borderRadius: 6 }}>
        <div className="bg-[#ed1a24] h-full" style={{ borderRadius: 6, width: `${percent}%` }} />
      </div>

      {!reportUnlocked ? (
        <>
          <button
            onClick={onOpenReportPaywall}
            className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ marginTop: 18, height: 48, borderRadius: 8, fontSize: 14, background: "#ed1a24", border: "none", cursor: "pointer", boxShadow: "0 4px 6px rgba(236,34,40,0.3)" }}
          >
            🔒 See my detailed report
          </button>
          <p className="text-white/40" style={{ fontSize: 12, margin: "10px 0 0", lineHeight: 1.6 }}>
            Why {score.toFixed(1)}? Your strengths, your gaps, and how to fix your CV — ₹299
          </p>
        </>
      ) : report ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topStrong && (
              <div className="bg-[#16803c]/10" style={{ borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span className="bg-[#16803c] text-white font-[family-name:var(--font-poppins)] font-bold" style={{ borderRadius: 50, padding: "2px 8px", fontSize: 10 }}>
                  Strong
                </span>
                <span className="font-[family-name:var(--font-poppins)] text-white/80" style={{ fontSize: 12.5 }}>
                  {topStrong}
                </span>
              </div>
            )}
            {topMissing && (
              <div className="bg-[#ed1a24]/10" style={{ borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span className="bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold" style={{ borderRadius: 50, padding: "2px 8px", fontSize: 10 }}>
                  Missing
                </span>
                <span className="font-[family-name:var(--font-poppins)] text-white/80" style={{ fontSize: 12.5 }}>
                  {topMissing}
                </span>
              </div>
            )}
          </div>
          <Link
            href="/hub/account/report"
            className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24] hover:text-[#ff6b6f] transition-colors"
            style={{ fontSize: 13, display: "inline-block", marginTop: 12 }}
          >
            Open full report →
          </Link>
        </div>
      ) : (
        <p className="text-white/40" style={{ fontSize: 12, margin: "18px 0 0" }}>
          Unlocked — your report is generating. Refresh in a moment.
        </p>
      )}
    </div>
  );
}
