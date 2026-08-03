import { useState } from "react";
import type { LookupResponse, TraitKey } from "./types";

type ScoreBand = { label: string; color: string; track: string };

function getScoreBand(score: number): ScoreBand {
  const clamped = Math.min(100, Math.max(0, score));
  if (clamped >= 70) return { label: "Strong", color: "#16803c", track: "#eefdf1" };
  if (clamped >= 40) return { label: "Developing", color: "#4b4b4d", track: "#f0e6ea" };
  return { label: "Needs work", color: "#ed1a24", track: "#fdeced" };
}

const TRAIT_LABELS: Record<TraitKey, string> = {
  O: "Openness",
  C: "Conscientiousness",
  E: "Extraversion",
  A: "Agreeableness",
  ES: "Emotional Stability",
};
const TRAIT_ORDER: TraitKey[] = ["O", "C", "E", "A", "ES"];

function Badge({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        top: 90,
        right: 24,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 999,
        boxShadow: "0 12px 30px rgba(17,35,89,0.18)",
        padding: "10px 16px",
        zIndex: 999999,
        fontFamily: "system-ui, sans-serif",
        fontSize: 12.5,
        fontWeight: 600,
        color: "#0a0a0a",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#ed1a24",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        M
      </span>
      Merito Preview available
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      style={{
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "#9c9c9c",
        margin: "0 0 8px",
      }}
    >
      {children}
    </p>
  );
}

function ScoreTile({ label, score, caption }: { label: string; score: number; caption?: string }) {
  const band = getScoreBand(score);
  return (
    <div style={{ background: band.track, borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{label}</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: band.color }}>{Math.round(score)}%</span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: band.color, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {band.label}
          </span>
        </span>
      </div>
      {caption && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#4b4b4d" }}>{caption}</p>}
    </div>
  );
}

export function Overlay({ data }: { data: LookupResponse }) {
  const [expanded, setExpanded] = useState(false);
  const sections = new Set(data.sections);

  if (!expanded) {
    return <Badge onClick={() => setExpanded(true)} />;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 90,
        right: 24,
        width: 320,
        maxHeight: "80vh",
        overflowY: "auto",
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 14,
        boxShadow: "0 18px 50px rgba(17,35,89,0.18)",
        padding: 18,
        zIndex: 999999,
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        color: "#0a0a0a",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <SectionLabel>Merito Recruiter Preview</SectionLabel>
        <button
          onClick={() => setExpanded(false)}
          aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, color: "#9c9c9c", padding: 0, marginLeft: 8 }}
        >
          ×
        </button>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 2px" }}>{data.candidateName}</h2>
      {data.roleTitle && <p style={{ margin: "0 0 16px", color: "#4b4b4d", fontSize: 12.5 }}>{data.roleTitle}</p>}

      {sections.has("fitment") && data.fitment && (
        <ScoreTile
          label="Fitment"
          score={data.fitment.report.overallScore}
          caption={`Matched against: ${data.fitment.matchedAgainstRoleTitle}`}
        />
      )}

      {sections.has("interview") && data.interview && (
        <ScoreTile label="AI Interview" score={data.interview.overallScore} caption={data.interview.overallSummary} />
      )}

      {sections.has("references") && data.references && (
        <ScoreTile label="References" score={data.references.overallScore * 20} caption={`${data.references.overallScore.toFixed(1)} / 5`} />
      )}

      {sections.has("personality") && data.personality && (
        <div style={{ marginTop: 4 }}>
          <SectionLabel>Personality</SectionLabel>
          {TRAIT_ORDER.map((trait) => {
            const score = data.personality?.[trait];
            if (!score) return null;
            const pct = Math.round(score.pct);
            return (
              <div key={trait} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11.5 }}>{TRAIT_LABELS[trait]}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "#4b4b4d" }}>{pct}%</span>
                </div>
                <div style={{ background: "#f0e6ea", borderRadius: 999, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "#ed1a24", borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
