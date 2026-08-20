"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AnswerDetail } from "@/lib/intervuebox/interviewReports";

// Same 70/40 thresholds as InterviewScoreGauge's getScoreBand, remapped to
// this panel's dark accent tokens -- kept local rather than imported since
// this dot only needs a color, not the full {label, trackColor} band shape.
function scoreDotColor(score: number | undefined): string {
  if (score == null) return "rgba(255,255,255,0.25)";
  if (score >= 70) return "#3FCB8C";
  if (score >= 40) return "#BD7E12";
  return "#E8798F";
}

// A real accordion (one item open at a time is not enforced -- any subset can
// be open) rather than the original single "view full transcript" toggle, so
// a candidate can compare two answers side by side without losing the first
// one's detail. Each row is a native <button> with aria-expanded/aria-controls
// wired to its panel, matching the disclosure pattern used elsewhere in this
// hub (see TopBar's dropdowns) rather than inventing a new one.
export default function AnswerTranscript({ answers }: { answers: AnswerDetail[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  if (answers.length === 0) {
    return (
      <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 13, margin: 0 }}>
        No question-by-question transcript is available for this interview.
      </p>
    );
  }

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap" style={{ marginBottom: 10, gap: 8 }}>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13, margin: 0 }}>
          {answers.length} question{answers.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center font-[family-name:var(--font-poppins)] font-medium text-[#ed1a24]" style={{ gap: 6, fontSize: 12 }}>
          <button
            type="button"
            onClick={() => setOpen(new Set(answers.map((_, i) => i)))}
            className="hover:underline"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit" }}
          >
            Expand all
          </button>
          <span className="text-white/30">·</span>
          <button
            type="button"
            onClick={() => setOpen(new Set())}
            className="hover:underline"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit" }}
          >
            Collapse all
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {answers.map((answer, i) => {
          const isOpen = open.has(i);
          const buttonId = `answer-trigger-${i}`;
          const panelId = `answer-panel-${i}`;
          return (
            <div key={i} className="bg-white/[0.03] border border-white/[0.08]" style={{ borderRadius: 12 }}>
              <button
                type="button"
                id={buttonId}
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center text-left"
                style={{ gap: 12, padding: "12px 14px", background: "none", border: "none", cursor: "pointer" }}
              >
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: scoreDotColor(answer.metrics.score), flexShrink: 0 }} />
                <span className="flex-1 font-[family-name:var(--font-poppins)] text-white truncate" style={{ fontSize: 13 }}>
                  {answer.question}
                </span>
                {answer.metrics.score != null && (
                  <span
                    className="font-[family-name:var(--font-poppins)] font-semibold"
                    style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: scoreDotColor(answer.metrics.score), flexShrink: 0 }}
                  >
                    {answer.metrics.score}%
                  </span>
                )}
                <ChevronDown
                  size={15}
                  strokeWidth={2}
                  className="text-white/40 transition-transform"
                  style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : undefined }}
                />
              </button>

              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "12px 14px 14px" }}
                >
                  <p className="font-[family-name:var(--font-poppins)] text-white/70" style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 10px", whiteSpace: "pre-wrap" }}>
                    {answer.transcript || "No answer given."}
                  </p>
                  {answer.metrics.dynamicSkills.length > 0 && (
                    <div className="flex flex-wrap" style={{ gap: 6, marginBottom: answer.metrics.evaluation ? 10 : 0 }}>
                      {answer.metrics.dynamicSkills.map((tag, j) => (
                        <span
                          key={j}
                          className="font-[family-name:var(--font-poppins)] text-white/50 border border-white/[0.12]"
                          style={{ fontSize: 11, borderRadius: 50, padding: "2px 10px" }}
                        >
                          {tag.skill}
                        </span>
                      ))}
                    </div>
                  )}
                  {answer.metrics.evaluation && (
                    <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                      {answer.metrics.evaluation}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
