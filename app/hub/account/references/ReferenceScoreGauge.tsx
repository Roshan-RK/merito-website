export type ReferenceScoreBand = { label: string; textColor: string; trackColor: string };

// Reference scores are a 0-5 average of referee ratings (see
// computeReferenceReport in lib/referenceChecks.ts), not the 0-100 scale
// ResumeMatchGauge/InterviewScoreGauge use -- so this is its own gauge rather
// than reusing theirs. Colors are dark-only (this gauge only ever renders on
// this panel's dark surface, unlike those two which also feed a light PDF
// export), but reuse the same green/amber/pink tokens already established
// across the dashboard for consistency.
export function getReferenceScoreBand(score: number): ReferenceScoreBand {
  const clamped = Math.min(5, Math.max(0, score));
  if (clamped >= 4) return { label: "Strong", textColor: "#3FCB8C", trackColor: "rgba(255,255,255,0.12)" };
  if (clamped >= 3) return { label: "Positive", textColor: "#BD7E12", trackColor: "rgba(255,255,255,0.12)" };
  return { label: "Mixed", textColor: "#E8798F", trackColor: "rgba(255,255,255,0.12)" };
}

export default function ReferenceScoreGauge({ score }: { score: number }) {
  const clamped = Math.min(5, Math.max(0, score));
  const band = getReferenceScoreBand(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / 5) * circumference;

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
            {clamped.toFixed(1)}
          </span>
        </div>
      </div>
      <span className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12.5 }}>
        Overall, out of 5
      </span>
    </div>
  );
}
