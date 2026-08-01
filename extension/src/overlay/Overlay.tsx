import type { LookupResponse } from "./types";

export function Overlay({ data }: { data: LookupResponse }) {
  const sections = new Set(data.sections);
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
      <p style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9c9c9c", margin: "0 0 8px" }}>
        Merito Recruiter Preview
      </p>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>{data.candidateName}</h2>
      {data.roleTitle && <p style={{ margin: "0 0 14px", color: "#4b4b4d" }}>{data.roleTitle}</p>}

      {sections.has("fitment") && data.fitment && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontWeight: 700, fontSize: 11, margin: "0 0 6px" }}>
            Fitment: {Math.round(data.fitment.report.overallScore)}%
          </p>
          <p style={{ margin: 0, color: "#9c9c9c", fontSize: 11.5 }}>
            Matched against: {data.fitment.matchedAgainstRoleTitle}
          </p>
        </div>
      )}

      {sections.has("personality") && data.personality && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontWeight: 700, fontSize: 11, margin: "0 0 6px" }}>Personality</p>
          {Object.entries(data.personality).map(([trait, score]) => (
            <p key={trait} style={{ margin: "0 0 2px", fontSize: 11.5 }}>
              {trait}: {Math.round(score.pct)}%
            </p>
          ))}
        </div>
      )}

      {sections.has("interview") && data.interview && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontWeight: 700, fontSize: 11, margin: "0 0 6px" }}>
            Interview: {Math.round(data.interview.overallScore)}%
          </p>
          <p style={{ margin: 0, fontSize: 11.5, color: "#4b4b4d" }}>{data.interview.overallSummary}</p>
        </div>
      )}

      {sections.has("references") && data.references && (
        <div>
          <p style={{ fontWeight: 700, fontSize: 11, margin: "0 0 6px" }}>
            References: {data.references.overallScore}/5
          </p>
        </div>
      )}
    </div>
  );
}
