export type MatchBand = { label: string; textColor: string; trackColor: string };

// Bands are Merito's own — IntervueBox's PDF export uses undocumented internal
// thresholds (e.g. "EXCELLENT" at 92%) we have no API access to. Reuses the
// same 3-tier color tokens as InterviewScoreGauge for visual consistency
// across both report pages.
export function getMatchBand(percent: number): MatchBand {
  const clamped = Math.min(100, Math.max(0, percent));
  if (clamped >= 80) return { label: "Excellent match", textColor: "#16803c", trackColor: "#eefdf1" };
  if (clamped >= 50) return { label: "Good match", textColor: "#4b4b4d", trackColor: "#f0e6ea" };
  return { label: "Needs review", textColor: "#ed1a24", trackColor: "#fdeced" };
}

// getMatchBand's colors are tuned for the light-theme PDF/export surfaces —
// and combined-report/share-token pages key off its exact textColor hex to
// remap their own palette (see combined-report/combinedBandColors.ts), so
// those values above must never change. This mirrors that same file's DARK
// remap for this panel's own dark UI instead of inventing new colors.
const DARK_BAND: Record<string, { textColor: string; trackColor: string }> = {
  "#16803c": { textColor: "#3FCB8C", trackColor: "rgba(255,255,255,0.12)" },
  "#4b4b4d": { textColor: "#BD7E12", trackColor: "rgba(255,255,255,0.12)" },
  "#ed1a24": { textColor: "#E8798F", trackColor: "rgba(255,255,255,0.12)" },
};

export function getMatchBandDark(percent: number): MatchBand {
  const band = getMatchBand(percent);
  return { ...band, ...(DARK_BAND[band.textColor] ?? {}) };
}

export default function ResumeMatchGauge({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const band = getMatchBandDark(percent);
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
        Overall match
      </span>
    </div>
  );
}
