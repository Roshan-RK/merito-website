import RequirementRow from "./RequirementRow";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";

export default function CategorySection({
  category,
  matchedCount,
  totalCount,
  requirements,
}: FitmentReportResult["categories"][number]) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.1rem", margin: 0 }}>
          {category}
        </h3>
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13 }}>
          {matchedCount} of {totalCount} matched
        </span>
      </div>
      <div className="bg-[#f0e6ea] overflow-hidden" style={{ height: 6, borderRadius: 6, marginBottom: 14 }}>
        <div
          className="bg-[#ed1a24] h-full"
          style={{ borderRadius: 6, width: `${totalCount > 0 ? (matchedCount / totalCount) * 100 : 0}%` }}
        />
      </div>
      {requirements.map((r, i) => (
        <RequirementRow
          key={i}
          requirement={r.requirement}
          matchLevel={r.matchLevel}
          isMustHave={r.isMustHave}
          evidence={r.evidence}
          note={r.note}
          interviewNote={r.interviewNote}
        />
      ))}
    </div>
  );
}
