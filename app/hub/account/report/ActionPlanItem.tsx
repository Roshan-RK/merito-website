export default function ActionPlanItem({
  priority,
  action,
  why,
}: {
  priority: number;
  action: string;
  why: string;
}) {
  const isTop = priority === 1;

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
        <p
          className="font-[family-name:var(--font-poppins)] font-semibold text-black"
          style={{ fontSize: isTop ? 15 : 13.5, margin: 0 }}
        >
          {action}
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, margin: "4px 0 0", lineHeight: 1.5 }}>
          {why}
        </p>
      </div>
    </div>
  );
}
