"use client";

import type { CSSProperties, ComponentType, ReactNode } from "react";
import Link from "next/link";
import { FileText, Brain, Users, Mic } from "lucide-react";
import type { InterviewStatus } from "./interviewProgress";

export type { InterviewStatus };
export type PersonalityStatus = "not_started" | "ready";

type PillState = "done" | "active" | "locked";

type Pill = {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  state: PillState;
  statusText: string;
  pulse?: boolean;
  href?: string;
  onClick?: () => void;
};

// Renders the 4 non-score steps (fitment score itself is shown on ScoreCard,
// not here) as status pills -- this replaces the old vertical progress rail
// + percent ring, which the mockup drops in favor of plain pills plus the
// "N of 5 steps complete" line already in DashboardClient's heading.
export default function ProgressRail({
  reportUnlocked,
  interviewStatus,
  referenceCheckStatus,
  personalityStatus,
  personalityUnlocked,
  referencesUnlocked,
  roleTitle,
  leadId,
  onOpenReportPaywall,
  onOpenPersonalityPaywall,
  onOpenReferencesPaywall,
  onOpenInterviewStart,
}: {
  reportUnlocked: boolean;
  interviewStatus: InterviewStatus;
  referenceCheckStatus: "none" | "in_progress" | "completed";
  personalityStatus: PersonalityStatus;
  personalityUnlocked: boolean;
  referencesUnlocked: boolean;
  roleTitle: string;
  leadId: string;
  onOpenReportPaywall: () => void;
  onOpenPersonalityPaywall: () => void;
  onOpenReferencesPaywall: () => void;
  onOpenInterviewStart: () => void;
}) {
  const referencesDone = referenceCheckStatus === "completed";

  const pills: Pill[] = [
    {
      key: "report",
      label: "Fitment report",
      icon: FileText,
      state: reportUnlocked ? "done" : "locked",
      statusText: reportUnlocked ? "Unlocked" : "Not started",
      href: reportUnlocked ? `/hub/account/report?lead=${encodeURIComponent(leadId)}` : undefined,
      onClick: reportUnlocked ? undefined : onOpenReportPaywall,
    },
    {
      key: "personality",
      label: "Personality test",
      icon: Brain,
      state: personalityStatus === "ready" ? "done" : personalityUnlocked ? "active" : "locked",
      statusText: personalityStatus === "ready" ? "Ready" : personalityUnlocked ? "Start test" : "Not started",
      href: personalityUnlocked ? `/hub/account/personality?role=${encodeURIComponent(roleTitle)}` : undefined,
      onClick: personalityUnlocked ? undefined : onOpenPersonalityPaywall,
    },
    {
      key: "references",
      label: "Reference checks",
      icon: Users,
      state: referencesDone ? "done" : referencesUnlocked ? "active" : "locked",
      statusText: referencesDone ? "Completed" : referenceCheckStatus === "in_progress" ? "In progress" : referencesUnlocked ? "Start" : "Not started",
      href: referencesUnlocked ? "/hub/account/references" : undefined,
      onClick: referencesUnlocked ? undefined : onOpenReferencesPaywall,
    },
    {
      key: "interview",
      label: "Mock interview",
      icon: Mic,
      state:
        interviewStatus === "ready"
          ? "done"
          : interviewStatus === "invited" || interviewStatus === "processing" || interviewStatus === "terminated" || interviewStatus === "stuck"
            ? "active"
            : "locked",
      statusText:
        interviewStatus === "ready"
          ? "Ready"
          : interviewStatus === "stuck"
            ? "Needs help"
            : interviewStatus === "terminated"
              ? "Interrupted"
              : interviewStatus === "processing"
                ? "Scoring…"
                : interviewStatus === "invited"
                  ? "Invited"
                  : "Not started",
      // No pulse for "stuck" -- unlike invited/processing/terminated, nothing
      // is pending on the vendor side; the row won't self-resolve without an
      // admin, so an animated "waiting" dot would be misleading.
      pulse: interviewStatus === "invited" || interviewStatus === "processing" || interviewStatus === "terminated",
      // Any status that has a real interview row (invited/ready/terminated/
      // stuck) links to the interview page -- that's where the "Start
      // Interview" button (invited), report (ready), and resume card
      // (terminated/stuck) all live. Only "not_started" opens the paywall.
      // Filter by lead_id: interview/page.tsx reads ?lead=, not ?role=.
      href:
        interviewStatus === "not_started"
          ? undefined
          : `/hub/account/interview?lead=${encodeURIComponent(leadId)}`,
      onClick: interviewStatus === "not_started" ? onOpenInterviewStart : undefined,
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 12 }}>
        {pills.map((pill) => (
          <StatusPill key={pill.key} pill={pill} />
        ))}
      </div>
    </div>
  );
}

function StatusPill({ pill }: { pill: Pill }) {
  const Icon = pill.icon;
  // Mirrors the mockup's status-badge tokens: success (done), warning
  // (in-progress/pending/actionable), neutral secondary (locked/not started).
  const tone =
    pill.state === "done"
      ? { bg: "rgba(53,182,130,0.15)", fg: "rgb(53,182,130)" }
      : pill.state === "active"
        ? { bg: "rgba(239,184,57,0.15)", fg: "rgb(239,184,57)" }
        : { bg: "rgb(39,37,45)", fg: "rgb(156,153,163)" };
  const compact = pill.state === "locked";

  const badge: ReactNode = (
    <span
      className="font-[family-name:var(--font-poppins)] font-medium"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 50,
        padding: compact ? "2px 10px" : "2px 10px",
        fontSize: compact ? 10 : 12,
        letterSpacing: compact ? "0.25px" : "normal",
        textTransform: compact ? "uppercase" : "none",
        background: tone.bg,
        color: tone.fg,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: tone.fg,
          animation: pill.pulse ? "merito-pulse 1.4s ease-in-out infinite" : undefined,
          display: "inline-block",
        }}
      />
      {pill.statusText}
    </span>
  );

  const style: CSSProperties = {
    borderRadius: 14,
    padding: "16px 16px",
    display: "block",
    textDecoration: "none",
    cursor: pill.href || pill.onClick ? "pointer" : "default",
  };

  const content = (
    <>
      <div
        className="flex items-center justify-center bg-[#ed1a24]/12 text-[#ed1a24]"
        style={{ width: 32, height: 32, borderRadius: 9, marginBottom: 12 }}
      >
        <Icon size={16} strokeWidth={2} />
      </div>
      <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13.5, margin: "0 0 8px" }}>
        {pill.label}
      </p>
      {badge}
    </>
  );

  if (pill.href) {
    return (
      <Link data-tour={`pill-${pill.key}`} href={pill.href} className="bg-[#141416] border border-white/[0.08] hover:border-white/[0.16] transition-colors" style={style}>
        {content}
      </Link>
    );
  }

  return (
    <button data-tour={`pill-${pill.key}`} onClick={pill.onClick} className="w-full text-left bg-[#141416] border border-white/[0.08] hover:border-white/[0.16] transition-colors" style={style}>
      {content}
    </button>
  );
}
