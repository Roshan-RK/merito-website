import { TRAITS, TRAIT_NAME, type Scores } from "@/lib/personality";

const SIZE = 300;
const CENTER = 150;
const MAX_RADIUS = 82;
const LABEL_RADIUS = MAX_RADIUS + 32;
const RING_FRACTIONS = [0.25, 0.5, 0.75, 1];

function angleFor(index: number, count: number): number {
  return (-90 + index * (360 / count)) * (Math.PI / 180);
}

function pointsFor(fractions: number[]): string {
  return fractions
    .map((f, i) => {
      const a = angleFor(i, fractions.length);
      const r = MAX_RADIUS * f;
      return `${CENTER + Math.cos(a) * r},${CENTER + Math.sin(a) * r}`;
    })
    .join(" ");
}

export default function CombinedRadar({ scores }: { scores: Scores }) {
  const values = TRAITS.map((t) => scores[t].pct / 100);
  const labels = TRAITS.map((t) => TRAIT_NAME[t]);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
      {RING_FRACTIONS.map((f) => (
        <polygon
          key={f}
          points={pointsFor(new Array(TRAITS.length).fill(f))}
          fill="none"
          stroke="#E6E1ED"
          strokeWidth={f === 1 ? 1.4 : 1}
        />
      ))}
      {TRAITS.map((t, i) => {
        const a = angleFor(i, TRAITS.length);
        return (
          <line
            key={t}
            x1={CENTER}
            y1={CENTER}
            x2={CENTER + Math.cos(a) * MAX_RADIUS}
            y2={CENTER + Math.sin(a) * MAX_RADIUS}
            stroke="#E6E1ED"
            strokeWidth={1}
          />
        );
      })}
      {TRAITS.map((t, i) => {
        const a = angleFor(i, TRAITS.length);
        const lx = CENTER + Math.cos(a) * LABEL_RADIUS;
        const ly = CENTER + Math.sin(a) * LABEL_RADIUS;
        const words = labels[i].split(" ");
        return (
          <text
            key={t}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--font-ibm-plex-mono)"
            fontSize={9.5}
            fill="#6C6779"
          >
            {words.map((w, wi) => (
              <tspan key={wi} x={lx} dy={wi === 0 ? 0 : 11}>
                {w}
              </tspan>
            ))}
          </text>
        );
      })}
      <polygon
        points={pointsFor(values)}
        fill="#4B4894"
        fillOpacity={0.16}
        stroke="#4B4894"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {values.map((v, i) => {
        const a = angleFor(i, TRAITS.length);
        const r = MAX_RADIUS * v;
        return <circle key={i} cx={CENTER + Math.cos(a) * r} cy={CENTER + Math.sin(a) * r} r={3.5} fill="#4B4894" />;
      })}
    </svg>
  );
}
