import { getScoreBand } from "../interview/InterviewScoreGauge";
import type { CriteriaEvaluationEntry } from "@/lib/intervuebox/interviewReports";
import { remapBand } from "./combinedBandColors";

export default function CombinedCriteriaCard({
  criteriaMatchScore,
  criteriaEvaluationTable,
}: {
  criteriaMatchScore: number;
  criteriaEvaluationTable: CriteriaEvaluationEntry[];
}) {
  const band = remapBand(getScoreBand(criteriaMatchScore));
  const matched = criteriaEvaluationTable.filter((e) => e.status === "Matched").length;
  const partial = criteriaEvaluationTable.filter((e) => e.status === "Partially Matched").length;
  const unmatched = criteriaEvaluationTable.filter((e) => e.status === "Not Matched").length;

  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 16, padding: "26px 30px", marginBottom: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <p
          className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]"
          style={{ fontSize: 11, letterSpacing: "0.1em", margin: 0 }}
        >
          Criteria Match Score
        </p>
        <span
          className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold uppercase"
          style={{ fontSize: 10, letterSpacing: "0.04em", color: band.textColor, background: band.trackColor, borderRadius: 50, padding: "3px 10px" }}
        >
          {band.label}
        </span>
      </div>
      <p className="font-[family-name:var(--font-fraunces)] font-semibold" style={{ fontSize: "2rem", margin: "0 0 16px", color: band.textColor }}>
        {Math.round(criteriaMatchScore)}%
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <div className="bg-[#E7F5EE]" style={{ borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#1E8F5E", margin: 0 }}>{matched}</p>
          <p style={{ fontSize: 10.5, color: "#1E8F5E", margin: 0 }}>Matched</p>
        </div>
        <div style={{ background: "#FBF1DF", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#BD7E12", margin: 0 }}>{partial}</p>
          <p style={{ fontSize: 10.5, color: "#BD7E12", margin: 0 }}>Partial</p>
        </div>
        <div className="bg-[#F6E7EB]" style={{ borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#95324B", margin: 0 }}>{unmatched}</p>
          <p style={{ fontSize: 10.5, color: "#95324B", margin: 0 }}>Unmatched</p>
        </div>
      </div>
    </div>
  );
}
