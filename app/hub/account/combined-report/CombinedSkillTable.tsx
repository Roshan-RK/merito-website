function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function scoreColor(score: number): string {
  if (score >= 70) return "#1E8F5E";
  if (score >= 40) return "#BD7E12";
  return "#95324B";
}

function scoreTierLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= 40) return "Proficient";
  return "Developing";
}

function scoreTierBg(score: number): string {
  if (score >= 70) return "#E7F5EE";
  if (score >= 40) return "#FBF1DF";
  return "#F6E7EB";
}

export default function CombinedSkillTable({ skillReport }: { skillReport: Record<string, { score: number; comment: string }> }) {
  const entries = Object.entries(skillReport);
  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 16, padding: "26px 30px", marginBottom: 20, breakInside: "avoid" }}>
      <p
        className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]"
        style={{ fontSize: 11, letterSpacing: "0.1em", margin: "0 0 18px" }}
      >
        Skill-wise evaluation
      </p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {entries.map(([skill, entry], i) => (
          <div
            key={skill}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr 84px",
              gap: 20,
              alignItems: "start",
              padding: "16px 0",
              borderTop: i > 0 ? "1px solid #E6E1ED" : undefined,
            }}
          >
            <p className="font-[family-name:var(--font-inter)] font-semibold text-black" style={{ fontSize: 14, margin: 0, paddingTop: 2 }}>
              {titleCase(skill)}
            </p>
            <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              {entry.comment}
            </p>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span className="font-[family-name:var(--font-fraunces)] font-semibold" style={{ fontSize: 20, color: scoreColor(entry.score) }}>
                {Math.round(entry.score)}
              </span>
              <span
                className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold uppercase"
                style={{ fontSize: 9.5, letterSpacing: "0.06em", padding: "2px 8px", borderRadius: 12, background: scoreTierBg(entry.score), color: scoreColor(entry.score) }}
              >
                {scoreTierLabel(entry.score)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
