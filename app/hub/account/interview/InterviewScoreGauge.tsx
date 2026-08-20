export type ScoreBand = { label: string; textColor: string; trackColor: string };

// Bands are Merito's own — IntervueBox's own POOR/GOOD/etc. thresholds are
// undocumented and inaccessible to us (see specs/2026-07-23-interview-report-ui-redesign-design.md).
// Colors reuse tokens already established elsewhere in the Hub (ProgressRail's
// "done" green, the existing muted-gray, Merito's primary red) rather than
// introducing a new palette.
// Score is IntervueBox's real 0-100 scale (live-confirmed 2026-07-28 against
// two real reports — see memory intervuebox-interview-modes), not the 0-10
// this file previously assumed.
//
// getScoreBand itself is unchanged (and still covered by
// __tests__/InterviewScoreGauge.test.ts) — getScoreBandDark below only remaps
// its output onto the same dark tokens report/ResumeMatchGauge.tsx already
// established for this dashboard's dark UI, instead of inventing a new palette.
export function getScoreBand(score: number): ScoreBand {
  const clamped = Math.min(100, Math.max(0, score));
  if (clamped >= 70) return { label: "Strong", textColor: "#16803c", trackColor: "#eefdf1" };
  if (clamped >= 40) return { label: "Developing", textColor: "#4b4b4d", trackColor: "#f0e6ea" };
  return { label: "Needs work", textColor: "#ed1a24", trackColor: "#fdeced" };
}

const DARK_BAND: Record<string, { textColor: string; trackColor: string }> = {
  "#16803c": { textColor: "#3FCB8C", trackColor: "rgba(255,255,255,0.12)" },
  "#4b4b4d": { textColor: "#BD7E12", trackColor: "rgba(255,255,255,0.12)" },
  "#ed1a24": { textColor: "#E8798F", trackColor: "rgba(255,255,255,0.12)" },
};

export function getScoreBandDark(score: number): ScoreBand {
  const band = getScoreBand(score);
  return { ...band, ...(DARK_BAND[band.textColor] ?? {}) };
}

export default function InterviewScoreGauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const band = getScoreBandDark(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center" style={{ gap: 10 }}>
      <span
        className="font-[family-name:var(--font-poppins)] font-bold uppercase"
        style={{ fontSize: 10.5, letterSpacing: "0.06em", color: band.textColor, background: band.trackColor, borderRadius: 50, padding: "4px 12px" }}
      >
        {band.label}
      </span>
      <div className="relative" style={{ width: 140, height: 140 }}>
        <svg width={140} height={140} viewBox="0 0 140 140">
          <circle cx={70} cy={70} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} />
          <circle
            cx={70}
            cy={70}
            r={radius}
            fill="none"
            stroke={band.textColor}
            strokeWidth={12}
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.23,1,0.32,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-[family-name:var(--font-gabarito)] font-bold text-white" style={{ fontSize: "1.7rem" }}>
            {Math.round(clamped)}%
          </span>
        </div>
      </div>
      <span className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12.5 }}>
        Overall interview score
      </span>
    </div>
  );
}
