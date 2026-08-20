import { Sparkles, AlertTriangle, TrendingUp, ShieldAlert } from "lucide-react";
import { parseEvaluatorNotes, parseInlineBold } from "@/lib/intervuebox/markdownNotes";

function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInlineBold(text).map((seg, i) => (seg.bold ? <strong key={i}>{seg.text}</strong> : <span key={i}>{seg.text}</span>))}
    </>
  );
}

// feedbackToInterviewer is free-form markdown -- IntervueBox's own headings
// aren't guaranteed, but a real captured report used exactly Strengths/
// Weaknesses/Opportunities/Threats/Training Needed (see
// lib/intervuebox/__tests__/markdownNotes.test.ts's REAL_NOTES fixture),
// which is the actual, non-fabricated source for this panel's SWOT-style
// cards -- unlike the mockup, headings here are whatever IntervueBox sends,
// so anything unrecognized still renders, just without a themed color.
const HEADING_TONE: { match: RegExp; icon: typeof Sparkles; textColor: string; bg: string }[] = [
  { match: /strength/i, icon: Sparkles, textColor: "#3FCB8C", bg: "rgba(63,203,140,0.08)" },
  { match: /weakness/i, icon: AlertTriangle, textColor: "#BD7E12", bg: "rgba(189,126,18,0.1)" },
  { match: /opportunit/i, icon: TrendingUp, textColor: "#60a5fa", bg: "rgba(96,165,250,0.08)" },
  { match: /threat/i, icon: ShieldAlert, textColor: "#E8798F", bg: "rgba(232,121,143,0.08)" },
];

function toneFor(heading: string) {
  return HEADING_TONE.find((t) => t.match.test(heading)) ?? null;
}

export default function InterviewEvaluatorNotes({ notes }: { notes: string }) {
  const parsed = parseEvaluatorNotes(notes);

  if (!parsed) {
    return (
      <p className="font-[family-name:var(--font-poppins)] text-white/70" style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
        <InlineText text={notes} />
      </p>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
        {parsed.sections.map((section, i) => {
          const tone = toneFor(section.heading);
          const Icon = tone?.icon;
          return (
            <div key={i} style={{ background: tone?.bg ?? "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14 }}>
              <div
                className="flex items-center font-[family-name:var(--font-poppins)] font-semibold uppercase"
                style={{ gap: 6, fontSize: 11, letterSpacing: "0.04em", margin: "0 0 8px", color: tone?.textColor ?? "rgba(255,255,255,0.55)" }}
              >
                {Icon && <Icon size={12} strokeWidth={2} />}
                {section.heading}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {section.items.map((item, j) => (
                  <p key={j} className="font-[family-name:var(--font-poppins)] text-white/70" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                    <InlineText text={item} />
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {parsed.recommendation && (
        <p
          className="font-[family-name:var(--font-poppins)] text-white/70"
          style={{ fontSize: 13, lineHeight: 1.7, margin: "14px 0 0", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="font-bold uppercase text-white/40" style={{ fontSize: 10.5 }}>
            Recommendation:{" "}
          </span>
          <InlineText text={parsed.recommendation} />
        </p>
      )}
    </div>
  );
}
