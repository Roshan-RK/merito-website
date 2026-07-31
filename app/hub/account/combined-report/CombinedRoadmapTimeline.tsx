import { parseRoadmap } from "@/lib/intervuebox/parseRoadmap";

export default function CombinedRoadmapTimeline({ roadmap }: { roadmap: string }) {
  const parsed = parseRoadmap(roadmap);

  if (!parsed) {
    return (
      <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 16, padding: "26px 30px", margin: "0 0 32px" }}>
        <p
          className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]"
          style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 10px" }}
        >
          Improvement roadmap
        </p>
        <p className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
          {roadmap}
        </p>
      </div>
    );
  }

  const { strengthsToLeverage, phases } = parsed;

  return (
    <div style={{ margin: "0 0 32px" }}>
      <p
        className="font-[family-name:var(--font-ibm-plex-mono)] uppercase text-[#6C6779]"
        style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 16px" }}
      >
        Improvement roadmap
      </p>

      <div className="bg-[#E7F5EE] border" style={{ borderColor: "#CFEBDC", borderRadius: 16, padding: "18px 22px", marginBottom: 20 }}>
        <p
          className="font-[family-name:var(--font-ibm-plex-mono)] uppercase"
          style={{ fontSize: 12, letterSpacing: "0.07em", color: "#1E8F5E", margin: "0 0 10px" }}
        >
          Strengths to leverage
        </p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {strengthsToLeverage.map((s, i) => (
            <li key={i} className="font-[family-name:var(--font-inter)] text-black" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, position: "relative" }}>
        <div style={{ position: "absolute", top: 11, left: 0, right: 0, height: 2, background: "#E6E1ED" }} />
        {phases.map((phase, i) => (
          <div key={i} style={{ paddingTop: 24, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#15121F",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
              }}
              className="font-[family-name:var(--font-ibm-plex-mono)]"
            >
              {i + 1}
            </div>
            <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 16, padding: "20px 22px", height: "100%", breakInside: "avoid" }}>
              <span
                className="font-[family-name:var(--font-ibm-plex-mono)] uppercase"
                style={{
                  display: "inline-block",
                  fontSize: 10.5,
                  letterSpacing: "0.05em",
                  background: "#ECEBF7",
                  color: "#4B4894",
                  padding: "3px 10px",
                  borderRadius: 20,
                  marginBottom: 10,
                }}
              >
                {phase.duration}
              </span>
              <h4 className="font-[family-name:var(--font-inter)] font-semibold text-black" style={{ fontSize: 15, margin: "0 0 14px", lineHeight: 1.4 }}>
                {phase.term}
              </h4>
              {phase.goal && (
                <p className="font-[family-name:var(--font-inter)]" style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 14px" }}>
                  <span className="text-[#6C6779] font-semibold uppercase" style={{ fontSize: 10, letterSpacing: "0.04em" }}>
                    Goal:{" "}
                  </span>
                  <span className="text-black">{phase.goal}</span>
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {phase.topics.map((topic, j) => (
                  <div key={j} style={{ paddingLeft: 12, borderLeft: "2px solid #E6E1ED" }}>
                    <p className="font-[family-name:var(--font-inter)] font-semibold text-black" style={{ fontSize: 13, margin: "0 0 4px" }}>
                      {topic.name}
                    </p>
                    {topic.whatToDo && (
                      <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 4px" }}>
                        <span className="font-semibold">What to do: </span>
                        {topic.whatToDo}
                      </p>
                    )}
                    {topic.resources && (
                      <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                        <span className="font-semibold">Resources: </span>
                        {topic.resources}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
