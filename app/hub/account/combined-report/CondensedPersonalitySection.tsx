import { TRAITS, TRAIT_NAME, TRAIT_MEANING, TRAIT_WORK_IMPLICATION, BANDS, traitLevel, type Scores } from "@/lib/personality";
import CombinedRadar from "./CombinedRadar";

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
    <>
      <div
        className="bg-white border border-black/[0.08]"
        style={{ borderRadius: 22, padding: 30, display: "grid", gridTemplateColumns: "320px 1fr", gap: 36, alignItems: "center", marginBottom: 20, breakInside: "avoid" }}
      >
        <div className="flex items-center justify-center">
          <CombinedRadar scores={scores} />
        </div>
        <div>
          <span
            className="font-[family-name:var(--font-ibm-plex-mono)] uppercase"
            style={{ fontSize: 11, letterSpacing: "0.06em", background: "#ECEBF7", color: "#4B4894", borderRadius: 20, padding: "5px 12px", display: "inline-block", marginBottom: 14 }}
          >
            Descriptive, not evaluative
          </span>
          <p className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>
            {candidateName} scores across five Big Five (OCEAN) traits — a working-style profile, not a competency score.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
        {TRAITS.map((t, i) => {
          const s = scores[t];
          const level = traitLevel(s.pct);
          const isLast = i === TRAITS.length - 1;
          return (
            <div
              key={t}
              className="bg-white border border-black/[0.08]"
              style={{ borderRadius: 16, padding: 20, breakInside: "avoid", gridColumn: isLast ? "1 / -1" : undefined }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <h3 className="font-[family-name:var(--font-inter)] font-semibold text-black" style={{ fontSize: "1.05rem", margin: 0 }}>
                  {TRAIT_NAME[t]}
                </h3>
                <span className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold text-[#4B4894]" style={{ fontSize: 12.5 }}>
                  {s.pct}% · {BANDS[s.band]}
                </span>
              </div>
              <p
                className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold uppercase text-[#6C6779]"
                style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "10px 0 3px" }}
              >
                What it measures
              </p>
              <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 10px" }}>
                {TRAIT_MEANING[t]}
              </p>
              <p
                className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold uppercase text-[#4B4894]"
                style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "0 0 3px" }}
              >
                At work
              </p>
              <p className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                {TRAIT_WORK_IMPLICATION[t][level](firstName)}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
