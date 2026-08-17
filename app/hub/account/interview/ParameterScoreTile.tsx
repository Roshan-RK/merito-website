function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export default function ParameterScoreTile({ skill, score }: { skill: string; score: number }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.08]" style={{ borderRadius: 12, padding: "14px 16px", breakInside: "avoid" }}>
      <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 11.5, margin: "0 0 6px" }}>
        {titleCase(skill)}
      </p>
      <p className="font-[family-name:var(--font-gabarito)] font-semibold text-[#ed1a24]" style={{ fontSize: "1.4rem", margin: 0 }}>
        {Math.round(score)}%
      </p>
    </div>
  );
}
