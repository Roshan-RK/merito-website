"use client";

import {
  TRAITS,
  TRAIT_NAME,
  TRAIT_MEANING,
  TRAIT_WORK_IMPLICATION,
  BANDS,
  traitLevel,
  validityFlags,
  type Scores,
  type Validity,
} from "@/lib/personality";

function BandStrip({ band }: { band: number }) {
  return (
    <div className="flex" style={{ gap: 6 }}>
      {BANDS.map((_, i) => (
        <div
          key={i}
          className={i === band ? "bg-[#ed1a24]" : "bg-[#f0e6ea]"}
          style={{ flex: 1, height: 10, borderRadius: 4 }}
        />
      ))}
    </div>
  );
}

export default function PersonalityReport({
  candidateName,
  roleTitle,
  scores,
  validity,
  onRetake,
}: {
  candidateName: string;
  roleTitle: string;
  scores: Scores;
  validity: Validity;
  onRetake?: () => void;
}) {
  const firstName = candidateName.split(/\s+/)[0] || candidateName;
  const flags = validityFlags(validity);

  const validityCells: { label: string; value: string; verdict: string; ok: boolean; note: string }[] = [
    {
      label: "Acquiescence (agree bias)",
      value: `${validity.meanRaw.toFixed(2)} avg`,
      verdict: validity.meanRaw >= 3.6 ? "Leans to agreeing" : validity.meanRaw <= 2.4 ? "Leans to disagreeing" : "Balanced",
      ok: validity.meanRaw < 3.6 && validity.meanRaw > 2.4,
      note: "Balanced ≈ 3.0 · higher = agrees regardless of content",
    },
    {
      label: "Central tendency",
      value: `${Math.round(validity.pctMid)}% midpoint`,
      verdict: validity.pctMid >= 40 ? "High midpoint use" : validity.pctMid >= 25 ? "Some midpoint use" : "Decisive",
      ok: validity.pctMid < 40,
      note: "Share of “neither” answers · high = fence-sitting",
    },
    {
      label: "Consistency",
      value: `${validity.incon.toFixed(2)} avg gap`,
      verdict: validity.incon >= 1.5 ? "High — possibly careless" : validity.incon >= 1.0 ? "Moderate" : "Consistent",
      ok: validity.incon < 1.5,
      note: "Agreement across similar item pairs · lower = consistent",
    },
    {
      label: "Social desirability",
      value: `${validity.sd.toFixed(2)} avg`,
      verdict: validity.sd >= 4 ? "Elevated" : validity.sd >= 3.25 ? "Moderate" : "Low",
      ok: validity.sd < 4,
      note: "Impression-management items · high = presenting favourably",
    },
  ];

  return (
    <div>
      <div
        className="bg-white border border-black/[0.08]"
        style={{ borderRadius: 20, padding: 24, boxShadow: "0 18px 50px rgba(17,35,89,0.05)" }}
      >
        <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 6px" }}>
          Personality Profile · Big Five (OCEAN)
        </p>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem", margin: "0 0 4px" }}>
          {candidateName}
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, margin: 0 }}>
          fit signal for {roleTitle}
        </p>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          {TRAITS.map((t) => (
            <div key={t}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13.5 }}>
                  {TRAIT_NAME[t]}
                </span>
                <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 12.5 }}>
                  {scores[t].pct}% · {BANDS[scores[t].band]}
                </span>
              </div>
              <BandStrip band={scores[t].band} />
            </div>
          ))}
        </div>
      </div>

      {TRAITS.map((t) => {
        const s = scores[t];
        const level = traitLevel(s.pct);
        return (
          <div
            key={t}
            className="bg-white border border-black/[0.08]"
            style={{ borderRadius: 20, padding: 24, marginTop: 16, boxShadow: "0 18px 50px rgba(17,35,89,0.05)" }}
          >
            <div className="flex items-start justify-between flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
              <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: 0 }}>
                {TRAIT_NAME[t]}
              </h2>
              <span className="font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24]" style={{ fontSize: "1.3rem" }}>
                {s.pct}%
              </span>
            </div>
            <BandStrip band={s.band} />
            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]" style={{ fontSize: 11, letterSpacing: "0.04em", margin: "16px 0 4px" }}>
              What it measures
            </p>
            <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14, lineHeight: 1.65, margin: 0 }}>
              {TRAIT_MEANING[t]}
            </p>
            <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]" style={{ fontSize: 11, letterSpacing: "0.04em", margin: "16px 0 4px" }}>
              What {firstName}&apos;s score suggests at work
            </p>
            <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14, lineHeight: 1.65, margin: 0 }}>
              {TRAIT_WORK_IMPLICATION[t][level](firstName)}
            </p>
          </div>
        );
      })}

      <div
        className="bg-white border border-black/[0.08]"
        style={{ borderRadius: 20, padding: 24, marginTop: 16, boxShadow: "0 18px 50px rgba(17,35,89,0.05)" }}
      >
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.15rem", margin: "0 0 4px" }}>
          Response quality &amp; validity checks
        </h2>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, margin: "0 0 16px" }}>
          Automated checks on how the questionnaire was answered — not part of the personality result itself.
        </p>
        <div className="grid grid-cols-2" style={{ gap: 12 }}>
          {validityCells.map((c) => (
            <div key={c.label} className="bg-[#fdf8fb]" style={{ borderRadius: 12, padding: "12px 14px" }}>
              <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11.5, margin: "0 0 2px" }}>
                {c.label}
              </p>
              <p className="font-[family-name:var(--font-poppins)] font-bold text-black" style={{ fontSize: 15, margin: "0 0 2px" }}>
                {c.value}
              </p>
              <p className={c.ok ? "text-[#16803c]" : "text-[#c77700]"} style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>
                {c.verdict}
              </p>
              <p className="text-[#9c9c9c]" style={{ fontSize: 11, margin: "4px 0 0" }}>
                {c.note}
              </p>
            </div>
          ))}
        </div>

        <div
          className={flags.length === 0 ? "bg-[#eefdf1]" : "bg-[#fdf4e3]"}
          style={{ borderRadius: 12, padding: "12px 16px", marginTop: 16, fontSize: 13 }}
        >
          <p className={flags.length === 0 ? "text-[#255e3f]" : "text-[#8a5a00]"} style={{ margin: 0, lineHeight: 1.6 }}>
            {flags.length === 0
              ? "Validity checks passed — the response pattern looks honest and attentive, so the scores can be read at face value."
              : `Interpret with some caution — the response pattern shows signs of ${flags.join(", ")}. Treat the trait scores as indicative and confirm anything important in a structured interview.`}
          </p>
        </div>
      </div>

      {onRetake && (
        <button
          onClick={onRetake}
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, marginTop: 20 }}
        >
          Retake test
        </button>
      )}
    </div>
  );
}
