import { CheckCircle2 } from "lucide-react";
import { parseRoadmap } from "@/lib/intervuebox/parseRoadmap";

// A dark-themed render of the same report.roadmap markdown the shared
// ../RoadmapTimeline.tsx already parses for the (light) admin/share-token/
// combined-report surfaces. Kept as a separate, panel-local component rather
// than reusing that file directly, so restyling this dashboard panel can't
// leak style changes onto those other light-themed surfaces.
export default function InterviewRoadmap({ roadmap }: { roadmap: string }) {
  const parsed = parseRoadmap(roadmap);

  if (!parsed) {
    return (
      <p className="font-[family-name:var(--font-poppins)] text-white/70" style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
        {roadmap}
      </p>
    );
  }

  const { strengthsToLeverage, phases } = parsed;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "rgba(63,203,140,0.08)", border: "1px solid rgba(63,203,140,0.25)", borderRadius: 14, padding: "14px 16px" }}>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-[#3FCB8C]" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
          Strengths to leverage
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {strengthsToLeverage.map((s, i) => (
            <div key={i} className="flex items-start" style={{ gap: 8 }}>
              <CheckCircle2 size={13} strokeWidth={2} className="shrink-0 text-[#3FCB8C]" style={{ marginTop: 3 }} />
              <span className="font-[family-name:var(--font-poppins)] text-white/70" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      {phases.map((phase, i) => (
        <div key={i} className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 16 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8, gap: 10 }}>
            <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 14, margin: 0 }}>
              {phase.term}
            </p>
            <span
              className="bg-[#ed1a24]/15 text-[#ed1a24] font-[family-name:var(--font-poppins)] font-bold"
              style={{ fontSize: 10.5, borderRadius: 50, padding: "3px 10px", whiteSpace: "nowrap" }}
            >
              {phase.duration}
            </span>
          </div>

          {phase.goal && (
            <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 12px" }}>
              <span className="text-white/40 font-semibold uppercase" style={{ fontSize: 10, letterSpacing: "0.04em" }}>
                Goal:{" "}
              </span>
              <span className="text-white/70">{phase.goal}</span>
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {phase.topics.map((topic, j) => (
              <div key={j} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12 }}>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 12.5, margin: "0 0 4px" }}>
                  {topic.name}
                </p>
                {topic.whatToDo && (
                  <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12, lineHeight: 1.6, margin: "0 0 4px" }}>
                    <span className="font-medium text-white/70">What to do: </span>
                    {topic.whatToDo}
                  </p>
                )}
                {topic.resources && (
                  <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                    <span className="font-medium text-white/70">Resources: </span>
                    {topic.resources}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
