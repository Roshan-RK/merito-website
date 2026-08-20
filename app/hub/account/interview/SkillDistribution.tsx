// Per user request, this component uses the mockup's own 5-tier scale
// (Exceptional/Proficient/Good/Unsatisfactory/Poor) instead of the 3-tier
// Strong/Developing/Needs work bands getScoreBand/getScoreBandDark use
// everywhere else in this panel (InterviewScoreGauge's overall gauge, the
// fitment report). Thresholds (>=60/>=45/>=35/>=15/else) and the
// success/success/warning/destructive/destructive color grouping are taken
// verbatim from mockups/merito-dashboard-v34.html's cy()/cw() helpers and
// its "Skill score distribution" 5-column grid. Colors are remapped onto
// this app's own dark palette using the same hex values getScoreBandDark's
// DARK_BAND already established for that success/warning/destructive
// semantics (green/amber/red-pink), rather than inventing a new palette.
// getScoreBand/getScoreBandDark themselves are untouched -- this bucketing
// is local to this component only.
const SUCCESS = "#3FCB8C";
const WARNING = "#BD7E12";
const DESTRUCTIVE = "#E8798F";

export function getSkillDistributionTier(score: number): { label: string; textColor: string } {
  if (score >= 60) return { label: "Exceptional", textColor: SUCCESS };
  if (score >= 45) return { label: "Proficient", textColor: SUCCESS };
  if (score >= 35) return { label: "Good", textColor: WARNING };
  if (score >= 15) return { label: "Unsatisfactory", textColor: DESTRUCTIVE };
  return { label: "Poor", textColor: DESTRUCTIVE };
}

const TIER_COLORS: Record<string, string> = {
  Exceptional: SUCCESS,
  Proficient: SUCCESS,
  Good: WARNING,
  Unsatisfactory: DESTRUCTIVE,
  Poor: DESTRUCTIVE,
};
const TIER_LABELS = Object.keys(TIER_COLORS) as (keyof typeof TIER_COLORS)[];

export default function SkillDistribution({ skillReport }: { skillReport: Record<string, { score: number; comment: string }> }) {
  const scores = Object.values(skillReport).map((entry) => entry.score);
  if (scores.length === 0) return null;

  const labels = scores.map((score) => getSkillDistributionTier(score).label);
  const buckets = TIER_LABELS.map((label) => ({
    label,
    textColor: TIER_COLORS[label],
    count: labels.filter((l) => l === label).length,
  }));

  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 16 }}>
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 12px" }}>
        Skill score distribution
      </p>
      <div className="grid grid-cols-5" style={{ gap: 8 }}>
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
