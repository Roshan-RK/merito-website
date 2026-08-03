import { useState } from "react";
import type { LookupResponse, TraitKey } from "./types";

const SERIF = "'Charter', 'Georgia', 'Cambria', serif";
const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace";
const SANS = "-apple-system, 'Segoe UI', Roboto, sans-serif";

type Band = { label: string; color: string; track: string };

function getBand(score: number): Band {
  const clamped = Math.min(100, Math.max(0, score));
  if (clamped >= 70) return { label: "Strong", color: "#16803c", track: "#eefdf1" };
  if (clamped >= 40) return { label: "Developing", color: "#4b4b4d", track: "#f0e6ea" };
  return { label: "Needs work", color: "#ed1a24", track: "#fdeced" };
}

const TRAIT_ORDER: TraitKey[] = ["O", "C", "E", "A", "ES"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function Badge({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        top: 90,
        right: 24,
        display: "flex",
        alignItems: "center",
        gap: 9,
        background: "#ffffff",
        border: "1px solid #E6E1ED",
        borderRadius: 999,
        boxShadow: "0 3px 10px rgba(20,15,35,0.12)",
        padding: "8px 14px",
        zIndex: 999999,
        fontFamily: SANS,
        fontSize: 12.5,
        fontWeight: 600,
        color: "#211D2C",
        cursor: "pointer",
      }}
    >
      <span style={{ fontFamily: SERIF, fontWeight: 700 }}>Merito</span>
      <span style={{ width: 1, height: 14, background: "#E6E1ED" }} />
      Preview available
    </button>
  );
}

function Ring({
  size,
  stroke,
  score,
  color,
  track,
  centerLabel,
}: {
  size: number;
  stroke: number;
  score: number;
  color: string;
  track: string;
  centerLabel: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: SERIF,
          fontWeight: 700,
          fontSize: size >= 60 ? 16 : 10.5,
        }}
      >
        {centerLabel}
      </div>
    </div>
  );
}

function SecondaryMetric({ label, score, centerLabel }: { label: string; score: number; centerLabel: string }) {
  const band = getBand(score);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ margin: "0 auto 4px" }}>
        <Ring size={44} stroke={4.5} score={score} color={band.color} track={band.track} centerLabel={centerLabel} />
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 500, fontFamily: SANS }}>{label}</div>
    </div>
  );
}

function DetailSection({
  index,
  label,
  pillText,
  pillColor,
  pillBg,
  sourceLine,
  body,
  last,
}: {
  index: string;
  label: string;
  pillText: string;
  pillColor: string;
  pillBg: string;
  sourceLine: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div style={{ borderTop: "1px solid #E6E1ED", padding: `12px 16px ${last ? 16 : 12}px` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: pillColor,
          }}
        >
          {index} · {label}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 8.5,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 20,
            background: pillBg,
            color: pillColor,
          }}
        >
          {pillText}
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: "#6C6779", marginBottom: 6, fontFamily: SANS }}>{sourceLine}</div>
      <div style={{ fontSize: 12, lineHeight: 1.55, fontFamily: SANS }}>{body}</div>
    </div>
  );
}

export function Overlay({ data }: { data: LookupResponse }) {
  const [expanded, setExpanded] = useState(false);
  const sections = new Set(data.sections);

  if (!expanded) {
    return <Badge onClick={() => setExpanded(true)} />;
  }

  const secondaryMetrics: { key: string; node: React.ReactNode }[] = [];
  if (sections.has("personality") && data.personality) {
    const traitCount = TRAIT_ORDER.filter((t) => data.personality?.scores[t]).length;
    secondaryMetrics.push({
      key: "personality",
      node: <SecondaryMetric label="Personality" score={100} centerLabel={`${traitCount}/5`} />,
    });
  }
  if (sections.has("interview") && data.interview) {
    secondaryMetrics.push({
      key: "interview",
      node: (
        <SecondaryMetric
          label="AI interview"
          score={data.interview.overallScore}
          centerLabel={`${Math.round(data.interview.overallScore)}%`}
        />
      ),
    });
  }
  if (sections.has("references") && data.references) {
    secondaryMetrics.push({
      key: "references",
      node: (
        <SecondaryMetric
          label="References"
          score={data.references.overallScore * 20}
          centerLabel={data.references.overallScore.toFixed(1)}
        />
      ),
    });
  }

  const fitmentBand = data.fitment ? getBand(data.fitment.report.overallScore) : null;

  return (
    <div
      style={{
        width: 372,
        maxHeight: "80vh",
        overflowY: "auto",
        position: "fixed",
        top: 90,
        right: 24,
        background: "#ffffff",
        border: "1px solid #E6E1ED",
        borderRadius: 16,
        boxShadow: "0 18px 50px rgba(17,35,89,0.18)",
        zIndex: 999999,
        color: "#211D2C",
      }}
    >
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15 }}>Merito</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 600,
                color: "#6C6779",
              }}
            >
              Recruiter preview
            </span>
            <button
              onClick={() => setExpanded(false)}
              aria-label="Close"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, lineHeight: 1, color: "#6C6779", padding: 0 }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 19, marginTop: 10 }}>{data.candidateName}</div>
        {data.roleTitle && (
          <div style={{ fontSize: 12.5, color: "#6C6779", marginTop: 1, fontFamily: SANS }}>
            Assessed for <span style={{ color: "#211D2C", fontWeight: 500 }}>{data.roleTitle}</span>
          </div>
        )}
      </div>

      {sections.has("fitment") && data.fitment && fitmentBand && (
        <div
          style={{
            margin: "14px 16px 0",
            padding: 14,
            borderRadius: 12,
            background: fitmentBand.track,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Ring
            size={64}
            stroke={6}
            score={data.fitment.report.overallScore}
            color={fitmentBand.color}
            track="rgba(0,0,0,0.08)"
            centerLabel={`${Math.round(data.fitment.report.overallScore)}%`}
          />
          <div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: 600,
                color: fitmentBand.color,
                marginBottom: 3,
              }}
            >
              Overall fitment
            </div>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17, color: fitmentBand.color }}>{fitmentBand.label}</div>
            <div style={{ fontSize: 10.5, color: "#6C6779", marginTop: 3, fontFamily: SANS }}>
              Matched against: {data.fitment.matchedAgainstRoleTitle}
            </div>
          </div>
        </div>
      )}

      {secondaryMetrics.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${secondaryMetrics.length}, 1fr)`, gap: 6, padding: "12px 16px" }}>
          {secondaryMetrics.map((m) => (
            <div key={m.key}>{m.node}</div>
          ))}
        </div>
      )}

      {sections.has("personality") && data.personality && (
        <DetailSection
          index="01"
          label="Personality"
          pillText="Descriptive, not scored"
          pillColor="#4B4894"
          pillBg="#ECEBF7"
          sourceLine={
            data.personality.completedAt
              ? `Based on self-reported assessment · ${formatDate(data.personality.completedAt)}`
              : "Based on self-reported assessment"
          }
          body={`Reports across ${TRAIT_ORDER.filter((t) => data.personality?.scores[t]).length} of 5 traits — see the full breakdown in the Hub for detail.`}
        />
      )}

      {sections.has("interview") && data.interview && (
        <DetailSection
          index="02"
          label="AI interview"
          pillText={getBand(data.interview.overallScore).label}
          pillColor={getBand(data.interview.overallScore).color}
          pillBg={getBand(data.interview.overallScore).track}
          sourceLine={`AI-proctored${
            data.interview.approxDurationMinutes ? ` · ~${data.interview.approxDurationMinutes} min` : ""
          } · ${formatDate(data.interview.completedAt)}`}
          body={data.interview.overallSummary}
        />
      )}

      {sections.has("references") && data.references && (
        <DetailSection
          index="03"
          label="References"
          pillText={getBand(data.references.overallScore * 20).label}
          pillColor={getBand(data.references.overallScore * 20).color}
          pillBg={getBand(data.references.overallScore * 20).track}
          sourceLine={`${data.references.referees.length} verified reference${
            data.references.referees.length === 1 ? "" : "s"
          } completed`}
          body={data.references.referees[0]?.overallFeedback ?? "No written feedback provided."}
          last
        />
      )}
    </div>
  );
}
