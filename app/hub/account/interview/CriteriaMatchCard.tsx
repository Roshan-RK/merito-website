"use client";

import { getScoreBandDark } from "./InterviewScoreGauge";
import { getCriteriaStatusColor, type CriteriaMatchStatus } from "@/lib/criteriaStatus";
import type { CriteriaEvaluationEntry } from "@/lib/intervuebox/interviewReports";

// getCriteriaStatusColor is shared with the light PDF export and the admin
// candidate view, so it stays untouched -- this just remaps its light hex
// onto the same dark tokens used across this panel (see getScoreBandDark).
const DARK_STATUS_COLOR: Record<string, string> = {
  "#16803c": "#3FCB8C",
  "#d97706": "#BD7E12",
  "#ed1a24": "#E8798F",
};
function statusColorDark(status: CriteriaMatchStatus): string {
  const light = getCriteriaStatusColor(status);
  return DARK_STATUS_COLOR[light] ?? light;
}

export default function CriteriaMatchCard({
  criteriaMatchScore,
  criteriaEvaluationTable,
}: {
  criteriaMatchScore: number;
  criteriaEvaluationTable: CriteriaEvaluationEntry[];
}) {
  const band = getScoreBandDark(criteriaMatchScore);
  const matched = criteriaEvaluationTable.filter((e) => e.status === "Matched").length;
  const partial = criteriaEvaluationTable.filter((e) => e.status === "Partially Matched").length;
  const unmatched = criteriaEvaluationTable.filter((e) => e.status === "Not Matched").length;
  const matchedColor = statusColorDark("Matched");
  const partialColor = statusColorDark("Partially Matched");
  const unmatchedColor = statusColorDark("Not Matched");

  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10, letterSpacing: "0.06em", margin: 0 }}>
          Criteria match score
        </p>
        <span
          className="font-[family-name:var(--font-poppins)] font-bold uppercase"
          style={{ fontSize: 10, letterSpacing: "0.04em", color: band.textColor, background: band.trackColor, borderRadius: 50, padding: "3px 10px" }}
        >
          {band.label}
        </span>
      </div>
      <p className="font-[family-name:var(--font-gabarito)] font-bold" style={{ fontSize: "2rem", margin: "0 0 16px", color: band.textColor }}>
        {Math.round(criteriaMatchScore)}%
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <div style={{ background: "rgba(63,203,140,0.1)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p className="font-[family-name:var(--font-gabarito)]" style={{ fontSize: 18, fontWeight: 700, color: matchedColor, margin: 0 }}>{matched}</p>
          <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 10.5, color: matchedColor, margin: 0 }}>Matched</p>
        </div>
        <div style={{ background: "rgba(189,126,18,0.12)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p className="font-[family-name:var(--font-gabarito)]" style={{ fontSize: 18, fontWeight: 700, color: partialColor, margin: 0 }}>{partial}</p>
          <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 10.5, color: partialColor, margin: 0 }}>Partial</p>
        </div>
        <div style={{ background: "rgba(232,121,143,0.12)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p className="font-[family-name:var(--font-gabarito)]" style={{ fontSize: 18, fontWeight: 700, color: unmatchedColor, margin: 0 }}>{unmatched}</p>
          <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 10.5, color: unmatchedColor, margin: 0 }}>Unmatched</p>
        </div>
      </div>
    </div>
  );
}
