export type ScoreBand = { label: string; textColor: string; trackColor: string };

// Bands are Merito's own — IntervueBox's own POOR/GOOD/etc. thresholds are
// undocumented and inaccessible to us (see specs/2026-07-23-interview-report-ui-redesign-design.md).
// Colors reuse tokens already established elsewhere in the Hub (ProgressRail's
// "done" green, the existing muted-gray, Merito's primary red) rather than
// introducing a new palette.
export function getScoreBand(score: number): ScoreBand {
  const clamped = Math.min(10, Math.max(0, score));
  if (clamped >= 7) return { label: "Strong", textColor: "#16803c", trackColor: "#eefdf1" };
  if (clamped >= 4) return { label: "Developing", textColor: "#4b4b4d", trackColor: "#f0e6ea" };
  return { label: "Needs work", textColor: "#ed1a24", trackColor: "#fdeced" };
}

export default function InterviewScoreGauge({ score }: { score: number }) {
  const clamped = Math.min(10, Math.max(0, score));
  const band = getScoreBand(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / 10) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
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
          y={68}
          textAnchor="middle"
          fontSize={28}
          fontWeight={700}
          fill="#000"
          className="font-[family-name:var(--font-gabarito)]"
        >
          {clamped}
        </text>
        <text
          x={70}
          y={86}
          textAnchor="middle"
          fontSize={12}
          fill="#9c9c9c"
          className="font-[family-name:var(--font-poppins)]"
        >
          / 10
        </text>
      </svg>
      <span
        className="font-[family-name:var(--font-poppins)] font-semibold"
        style={{ fontSize: 13, color: band.textColor }}
      >
        {band.label}
      </span>
    </div>
  );
}
