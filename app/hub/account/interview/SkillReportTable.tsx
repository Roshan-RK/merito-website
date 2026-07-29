"use client";

function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function scoreColor(score: number): string {
  if (score >= 70) return "#16803c";
  if (score >= 40) return "#d97706";
  return "#ed1a24";
}

export default function SkillReportTable({ skillReport }: { skillReport: Record<string, { score: number; comment: string }> }) {
  const entries = Object.entries(skillReport);
  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 14px" }}>
        Skill-wise evaluation
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {entries.map(([skill, entry], i) => (
          <div key={skill} style={{ borderTop: i > 0 ? "1px solid rgba(0,0,0,0.08)" : undefined, paddingTop: i > 0 ? 14 : 0 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.02rem", margin: 0 }}>
                {titleCase(skill)}
              </h3>
              <span
                className="font-[family-name:var(--font-poppins)] font-semibold"
                style={{ fontSize: 12, color: scoreColor(entry.score) }}
              >
                {Math.round(entry.score)}%
              </span>
            </div>
            <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              {entry.comment}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
