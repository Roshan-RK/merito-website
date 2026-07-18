function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export default function InterviewSkillCard({ skill, score }: { skill: string; score: number }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.05rem", margin: 0 }}>
          {titleCase(skill)}
        </h3>
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13 }}>
          {score}/100
        </span>
      </div>
      <div className="bg-[#f0e6ea] overflow-hidden" style={{ height: 6, borderRadius: 6 }}>
        <div
          className="bg-[#ed1a24] h-full"
          style={{ borderRadius: 6, width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}
