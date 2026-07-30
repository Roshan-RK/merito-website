import { parseRoadmap } from "@/lib/intervuebox/parseRoadmap";

export default function RoadmapTimeline({ roadmap }: { roadmap: string }) {
  const parsed = parseRoadmap(roadmap);

  if (!parsed) {
    return (
      <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, margin: "0 0 32px" }}>
        <p
          className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
          style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}
        >
          Improvement roadmap
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
          {roadmap}
        </p>
      </div>
    );
  }

  const { strengthsToLeverage, phases } = parsed;

  return (
    <div style={{ margin: "0 0 32px", breakInside: "avoid" }}>
      <p
        className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
        style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 10px" }}
      >
        Improvement roadmap
      </p>

      <div className="bg-[#fdf8fb] border border-black/[0.08]" style={{ borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
        <p className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 14, margin: "0 0 8px" }}>
          Strengths to leverage
        </p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {strengthsToLeverage.map((s, i) => (
            <li key={i} className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.7 }}>
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {phases.map((phase, i) => (
          <div
            key={i}
            className="bg-white"
            style={{ borderRadius: 14, padding: 18, borderLeft: "4px solid #ed1a24", boxShadow: "0 4px 16px rgba(17,35,89,0.04)", breakInside: "avoid" }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <p className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 15, margin: 0 }}>
                {phase.term}
              </p>
              <span
                className="bg-[#fdeced] text-[#ed1a24] font-[family-name:var(--font-poppins)] font-bold"
                style={{ fontSize: 11, borderRadius: 50, padding: "3px 12px", whiteSpace: "nowrap" }}
              >
                {phase.duration}
              </span>
            </div>

            {phase.goal && (
              <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 14px" }}>
                <span className="text-[#9c9c9c] font-semibold uppercase" style={{ fontSize: 10, letterSpacing: "0.04em" }}>
                  Goal:{" "}
                </span>
                <span className="text-black">{phase.goal}</span>
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {phase.topics.map((topic, j) => (
                <div key={j} style={{ paddingLeft: 12, borderLeft: "2px solid #f0e6ea" }}>
                  <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: "0 0 4px" }}>
                    {topic.name}
                  </p>
                  {topic.whatToDo && (
                    <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 4px" }}>
                      <span className="font-semibold text-[#9c9c9c]">What to do: </span>
                      {topic.whatToDo}
                    </p>
                  )}
                  {topic.resources && (
                    <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                      <span className="font-semibold text-[#9c9c9c]">Resources: </span>
                      {topic.resources}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
