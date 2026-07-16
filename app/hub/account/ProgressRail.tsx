"use client";

const STEPS = [
  { key: "score", label: "Job fitment score" },
  { key: "report", label: "Detailed report" },
  { key: "personality", label: "Personality test" },
  { key: "references", label: "Reference checks" },
  { key: "interview", label: "Mock AI interview" },
] as const;

export default function ProgressRail({
  reportUnlocked,
  onOpenReportPaywall,
}: {
  reportUnlocked: boolean;
  onOpenReportPaywall: () => void;
}) {
  const doneCount = 1 + (reportUnlocked ? 1 : 0); // score is always done; report counts once unlocked
  const percent = Math.round((doneCount / STEPS.length) * 100);
  const circumference = 2 * Math.PI * 31;
  const dashoffset = circumference - (percent / 100) * circumference;

  return (
    <div
      className="bg-white border border-black/[0.08]"
      style={{ borderRadius: 20, padding: 20, boxShadow: "0 18px 50px rgba(17,35,89,0.05)" }}
    >
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 14px" }}>
        Profile Progress
      </p>

      <div className="flex items-center" style={{ gap: 14, marginBottom: 16 }}>
        <svg width="74" height="74" viewBox="0 0 74 74">
          <circle cx="37" cy="37" r="31" fill="none" stroke="#f0e6ea" strokeWidth="8" />
          <circle
            cx="37"
            cy="37"
            r="31"
            fill="none"
            stroke="#ed1a24"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            transform="rotate(-90 37 37)"
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.23,1,0.32,1)" }}
          />
          <text x="37" y="42" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0a0a0a">
            {percent}%
          </text>
        </svg>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13 }}>
          {doneCount} of {STEPS.length} steps complete
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {STEPS.map((step, i) => {
          const isDone = step.key === "score" || (step.key === "report" && reportUnlocked);
          const isReportLocked = step.key === "report" && !reportUnlocked;
          const isComingSoon = step.key === "personality" || step.key === "references" || step.key === "interview";

          return (
            <div
              key={step.key}
              onClick={isReportLocked ? onOpenReportPaywall : undefined}
              className={isDone ? "bg-[#eefdf1]" : isReportLocked ? "bg-[#fdf8fb]" : "bg-white"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 12,
                minHeight: 44,
                cursor: isReportLocked ? "pointer" : "default",
                borderLeft: isReportLocked ? "5px solid #ed1a24" : "5px solid transparent",
              }}
            >
              <div
                className={isDone ? "bg-[#eefdf1] text-[#16803c]" : isComingSoon ? "bg-[#f0e6ea] text-[#9c9c9c]" : "bg-[#fdeced] text-[#ed1a24]"}
                style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, flex: 1 }}>
                {step.label}
              </span>
              {isComingSoon && (
                <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11 }}>
                  Coming soon
                </span>
              )}
              {isReportLocked && (
                <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 11 }}>
                  ₹299
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
