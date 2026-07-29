"use client";

import { useState } from "react";
import type { AnswerDetail } from "@/lib/intervuebox/interviewReports";

export default function AnswerTranscript({ answers }: { answers: AnswerDetail[] }) {
  const [expanded, setExpanded] = useState(false);

  if (answers.length === 0) return null;

  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}
      >
        {expanded ? "Hide" : "View"} full transcript ({answers.length} question{answers.length === 1 ? "" : "s"})
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 16 }}>
          {answers.map((answer, i) => (
            <div key={i} style={{ borderTop: i > 0 ? "1px solid rgba(0,0,0,0.08)" : undefined, paddingTop: i > 0 ? 18 : 0 }}>
              <p className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 13.5, margin: "0 0 8px" }}>
                {answer.question}
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 8px", whiteSpace: "pre-wrap" }}>
                {answer.transcript || "No answer given."}
              </p>
              <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                {answer.metrics.score != null && (
                  <span className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 11, background: "#ed1a24", borderRadius: 50, padding: "2px 10px" }}>
                    {answer.metrics.score}%
                  </span>
                )}
                {answer.metrics.dynamicSkills.map((tag, j) => (
                  <span key={j} className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11, border: "1px solid #dcdcdc", borderRadius: 50, padding: "2px 10px" }}>
                    {tag.skill}
                  </span>
                ))}
              </div>
              {answer.metrics.evaluation && (
                <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12, lineHeight: 1.6, margin: "8px 0 0" }}>
                  {answer.metrics.evaluation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
