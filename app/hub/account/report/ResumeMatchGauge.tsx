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

export default function ResumeMatchGauge({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const band = getMatchBand(percent);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <span
        className="font-[family-name:var(--font-poppins)] font-bold uppercase"
        style={{ fontSize: 10.5, letterSpacing: "0.06em", color: band.textColor, background: band.trackColor, borderRadius: 50, padding: "4px 12px" }}
      >
        {band.label}
      </span>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={70} cy={70} r={radius} fill="none" stroke={band.trackColor} strokeWidth={12} />
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
        />
        <text
          x={70}
          y={78}
          textAnchor="middle"
          fontSize={30}
          fontWeight={700}
          fill="#000"
          className="font-[family-name:var(--font-gabarito)]"
        >
          {Math.round(clamped)}%
        </text>
      </svg>
      <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5 }}>
        Overall match
      </span>
    </div>
  );
}
