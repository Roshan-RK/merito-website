import { parseEvaluatorNotes, parseInlineBold } from "@/lib/intervuebox/markdownNotes";

export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInlineBold(text).map((seg, i) => (seg.bold ? <strong key={i}>{seg.text}</strong> : <span key={i}>{seg.text}</span>))}
    </>
  );
}

export default function EvaluatorNotes({ notes }: { notes: string }) {
  const parsed = parseEvaluatorNotes(notes);

  if (!parsed) {
    return (
      <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, margin: "0 0 32px" }}>
        <p
          className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
          style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}
        >
          Evaluator notes for hiring teams
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
          <InlineText text={notes} />
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, margin: "0 0 32px", breakInside: "avoid" }}>
      <p
        className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
        style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 14px" }}
      >
        Evaluator notes for hiring teams
      </p>

      {parsed.sections.map((section, i) => (
        <div key={i} style={{ marginBottom: 14, breakInside: "avoid" }}>
          <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#4b4b4d]" style={{ fontSize: 11, letterSpacing: "0.04em", margin: "0 0 6px" }}>
            {section.heading}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {section.items.map((item, j) => (
              <li key={j} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.7 }}>
                <InlineText text={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {parsed.recommendation && (
        <p
          className="font-[family-name:var(--font-poppins)] text-black"
          style={{ fontSize: 13, lineHeight: 1.7, margin: 0, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)" }}
        >
          <span className="font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10.5 }}>
            Recommendation:{" "}
          </span>
          <InlineText text={parsed.recommendation} />
        </p>
      )}
    </div>
  );
}
