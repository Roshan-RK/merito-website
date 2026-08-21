const BAR_WIDTH = 20;
const GAP = 4;
const CHART_HEIGHT = 120;

function formatWeekLabel(weekStart: string): string {
  return new Date(weekStart).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export default function TrendBarChart({
  title,
  data,
  color,
  formatValue,
}: {
  title: string;
  data: { weekStart: string; value: number }[];
  color: string;
  formatValue: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = data.length * (BAR_WIDTH + GAP);

  return (
    <div>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11, margin: "0 0 8px" }}>
        {title}
      </p>
      <div style={{ overflowX: "auto" }}>
        <svg width={width} height={CHART_HEIGHT + 32} role="img" aria-label={`${title}, weekly, last ${data.length} weeks`}>
          <line x1={0} y1={CHART_HEIGHT} x2={width} y2={CHART_HEIGHT} stroke="#eee" strokeWidth={1} />
          {data.map((d, i) => {
            const barHeight = Math.max(2, (d.value / max) * (CHART_HEIGHT - 20));
            const x = i * (BAR_WIDTH + GAP);
            const y = CHART_HEIGHT - barHeight;
            const isLast = i === data.length - 1;
            return (
              <g key={d.weekStart}>
                <path
                  d={`M${x},${CHART_HEIGHT} L${x},${y + 4} Q${x},${y} ${x + 4},${y} L${x + BAR_WIDTH - 4},${y} Q${x + BAR_WIDTH},${y} ${x + BAR_WIDTH},${y + 4} L${x + BAR_WIDTH},${CHART_HEIGHT} Z`}
                  fill={color}
                />
                {isLast && (
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className="font-[family-name:var(--font-poppins)]"
                    style={{ fontSize: 10, fill: "#4b4b4d" }}
                  >
                    {formatValue(d.value)}
                  </text>
                )}
                {(i === 0 || isLast || i % 4 === 0) && (
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={CHART_HEIGHT + 16}
                    textAnchor="middle"
                    className="font-[family-name:var(--font-poppins)]"
                    style={{ fontSize: 9, fill: "#9c9c9c" }}
                  >
                    {formatWeekLabel(d.weekStart)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
