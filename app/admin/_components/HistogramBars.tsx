export default function HistogramBars({ title, buckets, color }: { title: string; buckets: { label: string; count: number }[]; color: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11, margin: "0 0 8px" }}>
        {title}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {buckets.map((b) => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]"
              style={{ fontSize: 10.5, width: 46, flexShrink: 0, textAlign: "right" }}
            >
              {b.label}
            </span>
            <div style={{ flex: 1, height: 16, background: "#f5f5f5", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ width: `${(b.count / max) * 100}%`, height: "100%", background: color, borderRadius: 8, minWidth: b.count > 0 ? 4 : 0 }} />
            </div>
            <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 11, width: 24, flexShrink: 0 }}>
              {b.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
