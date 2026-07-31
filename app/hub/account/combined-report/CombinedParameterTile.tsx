function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export default function CombinedParameterTile({ skill, score }: { skill: string; score: number }) {
  return (
    <div className="bg-[#F4F1F7] border border-black/[0.06]" style={{ borderRadius: 12, padding: "14px 16px", breakInside: "avoid" }}>
      <p
        className="font-[family-name:var(--font-ibm-plex-mono)] text-[#6C6779] uppercase"
        style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "0 0 8px" }}
      >
        {titleCase(skill)}
      </p>
      <p className="font-[family-name:var(--font-fraunces)] font-semibold text-[#DE3A2C]" style={{ fontSize: "1.3rem", margin: 0 }}>
        {Math.round(score)}%
      </p>
    </div>
  );
}
