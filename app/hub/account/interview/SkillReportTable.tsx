"use client";

import { getScoreBandDark } from "./InterviewScoreGauge";

function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export default function SkillReportTable({ skillReport }: { skillReport: Record<string, { score: number; comment: string }> }) {
  const entries = Object.entries(skillReport);
  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 20 }}>
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 14px" }}>
        Skill breakdown
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {entries.map(([skill, entry], i) => {
          const band = getScoreBandDark(entry.score);
          return (
            <div key={skill} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.08)" : undefined, paddingTop: i > 0 ? 14 : 0 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6, gap: 10 }}>
                <h3 className="flex items-center font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ gap: 8, fontSize: "1.02rem", margin: 0 }}>
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: band.textColor, flexShrink: 0 }} />
                  {titleCase(skill)}
                </h3>
                <span className="flex items-center" style={{ gap: 8 }}>
                  <span className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 11, color: band.textColor }}>
                    {band.label}
                  </span>
                  <span className="font-[family-name:var(--font-poppins)] font-semibold" style={{ fontSize: 12, color: band.textColor }}>
                    {Math.round(entry.score)}%
                  </span>
                </span>
              </div>
              <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                {entry.comment}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
