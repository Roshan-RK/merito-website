const SIZES = {
  64: { radius: 26, stroke: 6, numFont: 14 },
  96: { radius: 42, stroke: 8, numFont: 21 },
  150: { radius: 70, stroke: 11, numFont: 34 },
} as const;

export default function CombinedGauge({
  value,
  max,
  displayValue,
  caption,
  diameter,
  band,
  numberColor = "#0a0a0a",
}: {
  value: number;
  max: number;
  displayValue: string;
  caption?: string;
  diameter: 64 | 96 | 150;
  band: { textColor: string; trackColor: string };
  numberColor?: string;
}) {
  const { radius, stroke, numFont } = SIZES[diameter];
  const clamped = Math.min(max, Math.max(0, value));
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / max) * circumference;
  const c = diameter / 2;

  return (
    <div style={{ position: "relative", width: diameter, height: diameter, flexShrink: 0 }}>
      <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={c} cy={c} r={radius} fill="none" stroke={band.trackColor} strokeWidth={stroke} />
        <circle
          cx={c}
          cy={c}
          r={radius}
          fill="none"
          stroke={band.textColor}
          strokeWidth={stroke}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span className="font-[family-name:var(--font-fraunces)] font-semibold" style={{ fontSize: numFont, lineHeight: 1, color: numberColor }}>
          {displayValue}
        </span>
        {caption && (
          <span
            className="font-[family-name:var(--font-ibm-plex-mono)] text-[#6C6779]"
            style={{ fontSize: 10, letterSpacing: "0.05em", marginTop: 4, textAlign: "center", textTransform: "uppercase" }}
          >
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
