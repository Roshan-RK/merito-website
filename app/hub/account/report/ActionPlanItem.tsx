export default function ActionPlanItem({
  priority,
  action,
  why,
  effort,
}: {
  priority: number;
  action: string;
  why: string;
  effort: "quick" | "moderate" | "long-term";
}) {
  const isTop = priority === 1;
  const effortLabel = { quick: "Quick fix", moderate: "Takes practice", "long-term": "Long-term" }[effort];

  return (
    <div className="flex items-start" style={{ gap: 14, marginBottom: 16 }}>
      <div
        className="font-[family-name:var(--font-gabarito)] font-bold flex items-center justify-center flex-shrink-0"
        style={{
          width: isTop ? 34 : 28,
          height: isTop ? 34 : 28,
          borderRadius: "50%",
          fontSize: isTop ? 15 : 13,
          background: isTop ? "#ed1a24" : "transparent",
          color: isTop ? "#fff" : "#9c9c9c",
          border: isTop ? "none" : "1.5px solid #dcdcdc",
        }}
      >
        {priority}
      </div>
      <div>
        <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
          <p
            className="font-[family-name:var(--font-poppins)] font-semibold text-black"
            style={{ fontSize: isTop ? 15 : 13.5, margin: 0 }}
          >
            {action}
          </p>
          <span
            className="font-[family-name:var(--font-poppins)] font-semibold"
            style={{ fontSize: 10, color: "#9c9c9c", border: "1px solid #dcdcdc", borderRadius: 50, padding: "2px 8px" }}
          >
            {effortLabel}
          </span>
        </div>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, margin: "4px 0 0", lineHeight: 1.5 }}>
          {why}
        </p>
      </div>
    </div>
  );
}
