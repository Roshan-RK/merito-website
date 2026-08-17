import { getScoreBandDark } from "./InterviewScoreGauge";

// The mockup buckets skills into 5 tiers (Exceptional/Proficient/Good/
// Unsatisfactory/Poor) against thresholds that are illustrative only -- no
// such 5-way scale exists anywhere else in this codebase or is documented by
// IntervueBox. Bucketing by the same 3-tier Strong/Developing/Needs work
// bands getScoreBand already uses everywhere else in this panel (and the
// fitment report) keeps this reading honestly derived from real skillReport
// scores instead of inventing unverified thresholds.
export default function SkillDistribution({ skillReport }: { skillReport: Record<string, { score: number; comment: string }> }) {
  const scores = Object.values(skillReport).map((entry) => entry.score);
  if (scores.length === 0) return null;

  const buckets = [70, 40, 0].map((threshold) => {
    const band = getScoreBandDark(threshold);
    const count = scores.filter((score) => {
      if (threshold === 70) return score >= 70;
      if (threshold === 40) return score >= 40 && score < 70;
      return score < 40;
    }).length;
    return { ...band, count };
  });

  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 16 }}>
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 12px" }}>
        Skill score distribution
      </p>
      <div className="grid grid-cols-3" style={{ gap: 8 }}>
        {buckets.map((bucket) => (
          <div key={bucket.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <p className="font-[family-name:var(--font-gabarito)] font-bold" style={{ fontSize: 18, margin: "0 0 2px", color: bucket.textColor, fontVariantNumeric: "tabular-nums" }}>
              {bucket.count}
            </p>
            <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 10.5, margin: 0 }}>
              {bucket.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
