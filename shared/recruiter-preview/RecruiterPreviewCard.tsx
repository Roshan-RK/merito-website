"use client";

import { useState } from "react";
import type { CandidateLevel, LookupResponse } from "./types";

export type SectionKey = "fitment" | "personality" | "interview" | "references";

const SERIF = "'Charter', 'Georgia', 'Cambria', serif";
const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace";
const SANS = "-apple-system, 'Segoe UI', Roboto, sans-serif";

type Band = { label: string; color: string; track: string };

function getBand(score: number): Band {
  const clamped = Math.min(100, Math.max(0, score));
  if (clamped >= 75) return { label: "Strong", color: "#16803c", track: "#eefdf1" };
  if (clamped >= 60) return { label: "Moderate", color: "#bd7e12", track: "#fbf1df" };
  if (clamped >= 40) return { label: "Developing", color: "#4b4b4d", track: "#f0e6ea" };
  return { label: "Needs work", color: "#ed1a24", track: "#fdeced" };
}

const LEVEL_LABELS: Record<CandidateLevel, string> = {
  entry: "Entry-level",
  mid: "Mid-level",
  senior: "Senior-level",
};

const DELIVERY_PARAM_LABELS: Record<string, string> = {
  relevance: "Relevance",
  confidence: "Confidence",
  correctness: "Correctness",
  communication: "Communication",
  problemSolving: "Problem Solving",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function parseBullets(text: string): { label: string | null; text: string }[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (!match) return { label: null, text: line };
      return { label: match[1].replace(/:$/, ""), text: match[2] };
    });
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

function SecondaryMetric({
  label,
  score,
  centerLabel,
  active,
  onClick,
}: {
  label: string;
  score: number;
  centerLabel: string;
  active: boolean;
  onClick: () => void;
}) {
  const band = getBand(score);
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "center",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 4,
        borderRadius: 18,
        boxShadow: active ? `0 0 0 2px ${band.color}` : "0 0 0 2px transparent",
        transition: "box-shadow 150ms ease-out",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        <Ring size={44} stroke={4.5} score={score} color={band.color} track={band.track} centerLabel={centerLabel} />
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 500, fontFamily: SANS }}>{label}</div>
    </button>
  );
}

function DetailSection({
  index,
  label,
  pillText,
  pillColor,
  pillBg,
  sourceLine,
  children,
}: {
  index: string;
  label: string;
  pillText: string;
  pillColor: string;
  pillBg: string;
  sourceLine: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderTop: "1px solid #E6E1ED",
        padding: "12px 16px 16px",
        animation: "merito-section-in 180ms ease-out",
      }}
    >
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
      <div style={{ fontSize: 10.5, color: "#6C6779", marginBottom: 8, fontFamily: SANS }}>{sourceLine}</div>
      {children}
    </div>
  );
}

function ScorePill({ band }: { band: Band }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 8,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontWeight: 600,
        padding: "2px 6px",
        borderRadius: 20,
        background: band.track,
        color: band.color,
      }}
    >
      {band.label}
    </span>
  );
}

function CategoryRow({ label, score, comment }: { label: string; score: number; comment?: string }) {
  const band = getBand(score);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: comment ? 2 : 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: SANS }}>{label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: band.color, fontFamily: SANS, minWidth: 28, textAlign: "right" }}>
            {score}%
          </span>
          <ScorePill band={band} />
        </span>
      </div>
      {comment && <p style={{ fontSize: 11, color: "#6C6779", margin: 0, lineHeight: 1.5, fontFamily: SANS }}>{comment}</p>}
    </div>
  );
}

function TraitBar({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11.5, fontFamily: SANS }}>{label}</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#4b4b4d", fontFamily: SANS }}>{Math.round(clamped)}%</span>
      </div>
      <div style={{ background: "#f0e6ea", borderRadius: 999, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${clamped}%`, height: "100%", background: "#4B4894", borderRadius: 999 }} />
      </div>
    </div>
  );
}

function SkillRow({ skill, score, comment }: { skill: string; score: number; comment: string }) {
  const band = getBand(score);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: SANS }}>{skill}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: band.color, fontFamily: SANS, minWidth: 28, textAlign: "right" }}>
            {Math.round(score)}%
          </span>
          <ScorePill band={band} />
        </span>
      </div>
      <p style={{ fontSize: 11, color: "#6C6779", margin: 0, lineHeight: 1.5, fontFamily: SANS }}>{comment}</p>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function RefereeQuote({
  name,
  role,
  organization,
  feedback,
}: {
  name: string;
  role: string;
  organization: string | null;
  feedback: string | null;
}) {
  return (
    <div style={{ background: "#FAF9FC", borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#4B4894",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: SANS,
            flexShrink: 0,
          }}
        >
          {initials(name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, fontFamily: SANS, color: "#211D2C" }}>{name}</div>
          <div style={{ fontSize: 9.5, color: "#6C6779", fontFamily: SANS }}>
            {role}
            {organization ? ` · ${organization}` : ""} · Verified
          </div>
        </div>
      </div>
      {feedback && (
        <p style={{ fontSize: 12, fontStyle: "italic", color: "#332D41", margin: 0, lineHeight: 1.55, fontFamily: SANS }}>
          {feedback}
        </p>
      )}
    </div>
  );
}

function DeliveryParam({ label, score }: { label: string; score: number }) {
  const band = getBand(score);
  const clamped = Math.min(100, Math.max(0, score));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <span style={{ fontSize: 10.5, fontFamily: SANS }}>{label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: band.color, fontFamily: SANS }}>{Math.round(clamped)}%</span>
          <ScorePill band={band} />
        </span>
      </div>
      <div style={{ background: "#f0e6ea", borderRadius: 999, height: 4, overflow: "hidden" }}>
        <div style={{ width: `${clamped}%`, height: "100%", background: band.color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

export function RecruiterPreviewCard({
  data,
  activeSection,
  onSelectSection,
  logoUrl,
  onClose,
  onRequestContactDetails,
}: {
  data: LookupResponse;
  activeSection: SectionKey;
  onSelectSection: (key: SectionKey) => void;
  logoUrl: string;
  onClose?: () => void;
  onRequestContactDetails?: () => Promise<{ status: "pending" | "approved" | "denied" } | null>;
}) {
  const sections = new Set(data.sections);
  const [contactRequestState, setContactRequestState] = useState<"idle" | "requesting" | "pending" | "approved" | "denied">("idle");

  async function handleRequestContactDetails() {
    if (!onRequestContactDetails) return;
    setContactRequestState("requesting");
    const result = await onRequestContactDetails();
    setContactRequestState(result?.status ?? "idle");
  }

  const secondaryMetrics: { key: SectionKey; node: React.ReactNode }[] = [];
  if (sections.has("personality") && data.personality?.traits?.length) {
    const traitCount = data.personality.traits.length;
    secondaryMetrics.push({
      key: "personality",
      node: (
        <SecondaryMetric
          label="Personality"
          score={100}
          centerLabel={`${traitCount}/5`}
          active={activeSection === "personality"}
          onClick={() => onSelectSection("personality")}
        />
      ),
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
          active={activeSection === "interview"}
          onClick={() => onSelectSection("interview")}
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
          active={activeSection === "references"}
          onClick={() => onSelectSection("references")}
        />
      ),
    });
  }

  const fitmentBand = data.fitment ? getBand(data.fitment.report.overallScore) : null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 372,
        background: "#ffffff",
        border: "1px solid #E6E1ED",
        borderRadius: 16,
        boxShadow: "0 18px 50px rgba(17,35,89,0.18)",
        color: "#211D2C",
      }}
    >
      <style>{`
        @keyframes merito-section-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src={logoUrl} alt="Merito" style={{ height: 20, width: "auto", display: "block" }} />
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
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, lineHeight: 1, color: "#6C6779", padding: 0 }}
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 19, marginTop: 10 }}>{data.candidateName}</div>
        {data.roleTitle && (
          <div style={{ fontSize: 12.5, color: "#6C6779", marginTop: 1, fontFamily: SANS }}>
            Assessed for <span style={{ color: "#211D2C", fontWeight: 500 }}>{data.roleTitle}</span>
            {" · "}
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {LEVEL_LABELS[data.candidateLevel]}
            </span>
          </div>
        )}
      </div>

      {onRequestContactDetails && (
        <div style={{ padding: "0 16px", marginTop: 10 }}>
          {data.contactDetails ? (
            <div style={{ background: "#eefdf1", borderRadius: 10, padding: 10, fontSize: 11.5, fontFamily: SANS }}>
              <div style={{ fontWeight: 600, color: "#16803c", marginBottom: 3 }}>Contact details shared</div>
              <div>{data.contactDetails.email}</div>
              <div>{data.contactDetails.phone}</div>
            </div>
          ) : contactRequestState === "requesting" ? (
            <div style={{ fontSize: 11.5, color: "#6C6779", fontFamily: SANS }}>Requesting…</div>
          ) : contactRequestState === "pending" ? (
            <div style={{ fontSize: 11.5, color: "#6C6779", fontFamily: SANS }}>
              Request sent — you&apos;ll see contact details here once approved.
            </div>
          ) : contactRequestState === "denied" ? (
            <div style={{ fontSize: 11.5, color: "#6C6779", fontFamily: SANS }}>Request declined.</div>
          ) : (
            <button
              onClick={handleRequestContactDetails}
              style={{
                background: "none",
                border: "1px solid #E6E1ED",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 11.5,
                fontFamily: SANS,
                fontWeight: 600,
                color: "#4B4894",
                cursor: "pointer",
              }}
            >
              Request contact details
            </button>
          )}
        </div>
      )}

      {sections.has("fitment") && data.fitment && fitmentBand && (
        <button
          onClick={() => onSelectSection("fitment")}
          style={{
            display: "block",
            width: "calc(100% - 32px)",
            textAlign: "left",
            margin: "14px 16px 0",
            padding: 14,
            borderRadius: 12,
            background: fitmentBand.track,
            border: activeSection === "fitment" ? `2px solid ${fitmentBand.color}` : "2px solid transparent",
            transition: "border-color 150ms ease-out",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
        </button>
      )}

      {secondaryMetrics.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${secondaryMetrics.length}, 1fr)`, gap: 6, padding: "12px 16px" }}>
          {secondaryMetrics.map((m) => (
            <div key={m.key}>{m.node}</div>
          ))}
        </div>
      )}

      {activeSection === "fitment" && sections.has("fitment") && data.fitment && (
        <DetailSection
          index="01"
          label="Fitment"
          pillText={fitmentBand!.label}
          pillColor={fitmentBand!.color}
          pillBg={fitmentBand!.track}
          sourceLine={`Matched against: ${data.fitment.matchedAgainstRoleTitle}`}
        >
          {data.fitment.report.categories.map((c) => (
            <CategoryRow key={c.key} label={c.label} score={c.score} comment={c.comment} />
          ))}
        </DetailSection>
      )}

      {activeSection === "personality" && sections.has("personality") && data.personality && (
        <DetailSection
          index="02"
          label="Personality"
          pillText="Descriptive, not scored"
          pillColor="#4B4894"
          pillBg="#ECEBF7"
          sourceLine={
            data.personality.completedAt
              ? `Based on self-reported assessment · ${formatDate(data.personality.completedAt)}`
              : "Based on self-reported assessment"
          }
        >
          {data.personality.summary && (
            <p style={{ fontSize: 12, lineHeight: 1.6, color: "#332D41", margin: "0 0 12px", fontFamily: SANS }}>
              {data.personality.summary}
            </p>
          )}
          {(data.personality.traits ?? []).map((trait) => (
            <TraitBar key={trait.key} label={trait.label} pct={trait.pct} />
          ))}
        </DetailSection>
      )}

      {activeSection === "interview" && sections.has("interview") && data.interview && (
        <DetailSection
          index="03"
          label="AI interview"
          pillText={getBand(data.interview.overallScore).label}
          pillColor={getBand(data.interview.overallScore).color}
          pillBg={getBand(data.interview.overallScore).track}
          sourceLine={`AI-proctored${
            data.interview.approxDurationMinutes ? ` · ~${data.interview.approxDurationMinutes} min` : ""
          } · ${formatDate(data.interview.completedAt)}`}
        >
          {Object.keys(data.interview.skillMetrics).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px", marginBottom: 12 }}>
              {Object.entries(data.interview.skillMetrics).map(([key, score]) => (
                <DeliveryParam key={key} label={DELIVERY_PARAM_LABELS[key] ?? key} score={score} />
              ))}
            </div>
          )}
          <p style={{ fontSize: 12, lineHeight: 1.55, margin: "0 0 10px", fontFamily: SANS }}>{data.interview.overallSummary}</p>
          {data.interview.strengths && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#16803c", margin: "0 0 4px", fontFamily: SANS }}>
                Strengths
              </p>
              {parseBullets(data.interview.strengths).map((item, i) => (
                <p key={i} style={{ fontSize: 11.5, margin: "0 0 4px", lineHeight: 1.5, fontFamily: SANS }}>
                  {item.label && <strong>{item.label}</strong>}
                  {item.label ? " — " : ""}
                  {item.text}
                </p>
              ))}
            </div>
          )}
          {Object.entries(data.interview.skillReport).map(([skill, entry]) => (
            <SkillRow key={skill} skill={skill} score={entry.score} comment={entry.comment} />
          ))}
        </DetailSection>
      )}

      {activeSection === "references" && sections.has("references") && data.references && (
        <DetailSection
          index="04"
          label="References"
          pillText={getBand(data.references.overallScore * 20).label}
          pillColor={getBand(data.references.overallScore * 20).color}
          pillBg={getBand(data.references.overallScore * 20).track}
          sourceLine={`${data.references.referees.length} verified reference${
            data.references.referees.length === 1 ? "" : "s"
          } completed`}
        >
          {data.references.categoryScores.map((c) => (
            <CategoryRow key={c.category} label={c.label} score={c.value * 20} />
          ))}
          <div style={{ borderTop: "1px solid #E6E1ED", marginTop: 4, paddingTop: 10 }}>
            {data.references.referees.map((r, i) => (
              <RefereeQuote key={i} name={r.name} role={r.role} organization={r.organization} feedback={r.overallFeedback} />
            ))}
          </div>
        </DetailSection>
      )}
    </div>
  );
}
