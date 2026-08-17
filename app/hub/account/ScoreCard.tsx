"use client";

export default function ScoreCard({
  roleTitle,
  score,
  verdict,
}: {
  roleTitle: string;
  score: number;
  verdict: string;
}) {
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
          <span className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/45" style={{ fontSize: 11, letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
            Job Fitment Score
          </span>

          <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 15, margin: "0 0 6px" }}>
            {roleTitle}
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            {verdict}
          </p>
        </div>
      </div>
    </div>
  );
}
