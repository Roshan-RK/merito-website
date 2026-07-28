"use client";

import { getScoreBand } from "./InterviewScoreGauge";
import type { CriteriaEvaluationEntry } from "@/lib/intervuebox/interviewReports";

export default function CriteriaMatchCard({
  criteriaMatchScore,
  criteriaEvaluationTable,
}: {
  criteriaMatchScore: number;
  criteriaEvaluationTable: CriteriaEvaluationEntry[];
}) {
  const band = getScoreBand(criteriaMatchScore);
  const matched = criteriaEvaluationTable.filter((e) => e.status === "Matched").length;
  const partial = criteriaEvaluationTable.filter((e) => e.status === "Partially Matched").length;
  const unmatched = criteriaEvaluationTable.filter((e) => e.status === "Not Matched").length;

  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: 0 }}>
          Criteria Match Score
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
        <div className="bg-[#eefdf1]" style={{ borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#16803c", margin: 0 }}>{matched}</p>
          <p style={{ fontSize: 10.5, color: "#16803c", margin: 0 }}>Matched</p>
        </div>
        <div style={{ background: "#fff7ed", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#d97706", margin: 0 }}>{partial}</p>
          <p style={{ fontSize: 10.5, color: "#d97706", margin: 0 }}>Partial</p>
        </div>
        <div className="bg-[#fdeced]" style={{ borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#ed1a24", margin: 0 }}>{unmatched}</p>
          <p style={{ fontSize: 10.5, color: "#ed1a24", margin: 0 }}>Unmatched</p>
        </div>
      </div>
    </div>
  );
}
