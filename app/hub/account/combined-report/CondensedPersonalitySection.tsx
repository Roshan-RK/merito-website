import { TRAITS, TRAIT_NAME, TRAIT_MEANING, TRAIT_WORK_IMPLICATION, BANDS, traitLevel, type Scores } from "@/lib/personality";

// Compact 2-column card grid matching the specimen's Personality Profile
// layout — deliberately NOT the same component as the standalone
// /hub/account/personality page's PersonalityReport (which stays verbose,
// with per-trait full-width cards and a validity-checks block). This
// combined-report-only variant exists because the specimen has no
// equivalent to that validity-checks section and expects each trait's
// "what it measures" + "at work" text inside one small card, not spread
// across separate full-width cards.
export default function CondensedPersonalitySection({
  candidateName,
  scores,
}: {
  candidateName: string;
  scores: Scores;
}) {
  const firstName = candidateName.split(/\s+/)[0] || candidateName;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14 }}>
      {TRAITS.map((t) => {
        const s = scores[t];
        const level = traitLevel(s.pct);
        return (
          <div key={t} className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 18, breakInside: "avoid" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
              <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.05rem", margin: 0 }}>
                {TRAIT_NAME[t]}
              </h3>
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 13 }}>
                {s.pct}% · {BANDS[s.band]}
              </span>
            </div>
            <p
              className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]"
              style={{ fontSize: 10, letterSpacing: "0.04em", margin: "10px 0 3px" }}
            >
              What it measures
            </p>
            <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 10px" }}>
              {TRAIT_MEANING[t]}
            </p>
            <p
              className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]"
              style={{ fontSize: 10, letterSpacing: "0.04em", margin: "0 0 3px" }}
            >
              At work
            </p>
            <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
              {TRAIT_WORK_IMPLICATION[t][level](firstName)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
