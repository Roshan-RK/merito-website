export default function RequirementRow({
  requirement,
  matchLevel,
  isMustHave,
  evidence,
  note,
  interviewNote,
}: {
  requirement: string;
  matchLevel: "strong" | "partial" | "missing";
  isMustHave: boolean;
  evidence: string;
  note: string;
  interviewNote: string;
}) {
  const chipStyles = {
    strong: { bg: "#eefdf1", fg: "#16803c", label: "Strong match" },
    partial: { bg: "#fef3e2", fg: "#b45309", label: "Partial match" },
    missing: { bg: "#fdeced", fg: "#ed1a24", label: "Missing" },
  }[matchLevel];

  const hasEvidence = evidence !== "Not found in CV";

  return (
    <div
      className="bg-white border border-black/[0.08]"
      style={{ borderRadius: 14, padding: 18, marginBottom: 14 }}
    >
      <div className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 10 }}>
        <span
          className="font-[family-name:var(--font-poppins)] font-bold"
          style={{ background: chipStyles.bg, color: chipStyles.fg, borderRadius: 50, padding: "3px 10px", fontSize: 11 }}
        >
          {chipStyles.label}
        </span>
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14 }}>
          {requirement}
        </span>
        <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 10.5, marginLeft: "auto" }}>
          {isMustHave ? "Must-have" : "Nice-to-have"}
        </span>
      </div>

      {hasEvidence ? (
        <div
          style={{
            borderLeft: `3px solid ${chipStyles.fg}`,
            background: chipStyles.bg,
            borderRadius: "0 8px 8px 0",
            padding: "10px 14px",
            marginBottom: 10,
          }}
        >
          <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13, fontStyle: "italic", color: "#4b4b4d", margin: 0 }}>
            &ldquo;{evidence}&rdquo;
          </p>
          <p
            className="font-[family-name:var(--font-poppins)] font-semibold uppercase"
            style={{ fontSize: 10, letterSpacing: "0.06em", color: "#9c9c9c", margin: "6px 0 0" }}
          >
            — from your CV
          </p>
        </div>
      ) : (
        <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13, color: "#9c9c9c", fontStyle: "italic", margin: "0 0 10px" }}>
          Not found in your CV.
        </p>
      )}

      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        {note}
      </p>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #dcdcdc" }}>
        <p
          className="font-[family-name:var(--font-poppins)] font-semibold uppercase"
          style={{ fontSize: 10, letterSpacing: "0.06em", color: "#9c9c9c", margin: "0 0 4px" }}
        >
          How to talk about this
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
          {interviewNote}
        </p>
      </div>
    </div>
  );
}
