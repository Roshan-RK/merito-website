"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";
import { durationForLevel } from "@/lib/intervuebox/agents";

const STEPS = [
  { key: "score", label: "Job fitment score" },
  { key: "report", label: "Detailed report" },
  { key: "personality", label: "Personality test" },
  { key: "references", label: "Reference checks" },
  { key: "interview", label: "Mock AI interview" },
] as const;

export type InterviewStatus = "not_started" | "invited" | "ready";
export type PersonalityStatus = "not_started" | "ready";

// No real "interview finished, report generating" signal exists from
// IntervueBox today (live-confirmed 2026-08-10 — see
// specs/2026-08-10-interview-status-messaging-design.md) -- this is a
// heuristic against the known interview slot length, not a real state.
export function isInterviewGenerating(
  interviewStatus: InterviewStatus,
  interviewInvitedAt: string | null,
  level: CandidateLevel,
  now: number = Date.now()
): boolean {
  if (interviewStatus !== "invited" || interviewInvitedAt == null) return false;
  return now - new Date(interviewInvitedAt).getTime() >= durationForLevel(level) * 60_000;
}

export default function ProgressRail({
  reportUnlocked,
  interviewStatus,
  interviewInvitedAt,
  referenceCheckStatus,
  personalityStatus,
  personalityUnlocked,
  referencesUnlocked,
  level,
  roleTitle,
  onOpenReportPaywall,
  onOpenPersonalityPaywall,
  onOpenReferencesPaywall,
  onOpenInterviewStart,
  onOpenInterviewCheck,
  onOpenGenerateReport,
}: {
  reportUnlocked: boolean;
  interviewStatus: InterviewStatus;
  interviewInvitedAt: string | null;
  referenceCheckStatus: "none" | "in_progress" | "completed";
  personalityStatus: PersonalityStatus;
  personalityUnlocked: boolean;
  referencesUnlocked: boolean;
  level: CandidateLevel;
  roleTitle: string;
  onOpenReportPaywall: () => void;
  onOpenPersonalityPaywall: () => void;
  onOpenReferencesPaywall: () => void;
  onOpenInterviewStart: () => void;
  onOpenInterviewCheck: () => void;
  onOpenGenerateReport: () => void;
}) {
  const interviewGenerating = isInterviewGenerating(interviewStatus, interviewInvitedAt, level);
  const referencesDone = referenceCheckStatus === "completed";
  const doneCount =
    1 +
    (reportUnlocked ? 1 : 0) +
    (personalityStatus === "ready" ? 1 : 0) +
    (referencesDone ? 1 : 0) +
    (interviewStatus === "ready" ? 1 : 0);
  const percent = Math.round((doneCount / STEPS.length) * 100);
  const circumference = 2 * Math.PI * 31;
  const dashoffset = circumference - (percent / 100) * circumference;

  return (
    <div
      className="bg-white border border-black/[0.08]"
      style={{ borderRadius: 20, padding: 20, boxShadow: "0 18px 50px rgba(17,35,89,0.05)" }}
    >
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 14px" }}>
        Profile Progress
      </p>

      <div className="flex items-center" style={{ gap: 14, marginBottom: 16 }}>
        <svg width="74" height="74" viewBox="0 0 74 74">
          <circle cx="37" cy="37" r="31" fill="none" stroke="#f0e6ea" strokeWidth="8" />
          <circle
            cx="37"
            cy="37"
            r="31"
            fill="none"
            stroke="#ed1a24"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            transform="rotate(-90 37 37)"
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.23,1,0.32,1)" }}
          />
          <text x="37" y="42" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0a0a0a">
            {percent}%
          </text>
        </svg>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13 }}>
          {doneCount} of {STEPS.length} steps complete
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {STEPS.map((step, i) => {
          const isReportLocked = step.key === "report" && !reportUnlocked;
          const isInterviewStep = step.key === "interview";
          const isReferencesStep = step.key === "references";
          const isPersonalityStep = step.key === "personality";
          const isPersonalityLocked = isPersonalityStep && !personalityUnlocked;
          const isReferencesLocked = isReferencesStep && !referencesUnlocked;

          const isDone =
            step.key === "score" ||
            (step.key === "report" && reportUnlocked) ||
            (isPersonalityStep && personalityStatus === "ready") ||
            (isReferencesStep && referencesDone) ||
            (isInterviewStep && interviewStatus === "ready");

          let rightBadge: ReactNode = null;
          if (isPersonalityLocked) {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 11 }}>
                {formatPrice(PRODUCT_PRICING.personality[level])}
              </span>
            );
          } else if (isReferencesLocked) {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 11 }}>
                {formatPrice(PRODUCT_PRICING.references[level])}
              </span>
            );
          } else if (isPersonalityStep && personalityStatus === "not_started") {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 11 }}>
                Start
              </span>
            );
          } else if (isReportLocked) {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 11 }}>
                ₹299
              </span>
            );
          } else if (isReferencesStep && referenceCheckStatus === "in_progress") {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11 }}>
                In progress
              </span>
            );
          } else if (isInterviewStep && interviewStatus === "invited") {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#9c9c9c]" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#ed1a24",
                    animation: "merito-pulse 1.4s ease-in-out infinite",
                  }}
                />
                {interviewGenerating ? "Generating report" : "Invited — check your email"}
              </span>
            );
          } else if (isInterviewStep && interviewStatus === "not_started") {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 11 }}>
                {formatPrice(PRODUCT_PRICING.interview[level])}
              </span>
            );
          }

          const isClickable =
            isReportLocked ||
            isPersonalityLocked ||
            isReferencesLocked ||
            (isInterviewStep && (interviewStatus === "not_started" || interviewStatus === "invited"));
          const isLinkable =
            (isReferencesStep && referencesUnlocked) ||
            (isInterviewStep && interviewStatus === "ready") ||
            (isPersonalityStep && personalityUnlocked);

          const rowStyle: CSSProperties = {
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 12,
            minHeight: 44,
            cursor: isClickable || isLinkable ? "pointer" : "default",
            borderLeft: isClickable ? "5px solid #ed1a24" : "5px solid transparent",
          };
          const rowClassName = isDone ? "bg-[#eefdf1]" : isClickable ? "bg-[#fdf8fb]" : "bg-white";

          const content = (
            <>
              <div
                className={isDone ? "bg-[#eefdf1] text-[#16803c]" : "bg-[#fdeced] text-[#ed1a24]"}
                style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, flex: 1 }}>
                {step.label}
              </span>
              {rightBadge}
            </>
          );

          if (isLinkable) {
            const href = isReferencesStep
              ? "/hub/account/references"
              : isPersonalityStep
                ? `/hub/account/personality?role=${encodeURIComponent(roleTitle)}`
                : `/hub/account/interview?role=${encodeURIComponent(roleTitle)}`;
            return (
              <Link key={step.key} href={href} className={rowClassName} style={rowStyle}>
                {content}
              </Link>
            );
          }

          return (
            <div
              key={step.key}
              onClick={
                isReportLocked
                  ? onOpenReportPaywall
                  : isPersonalityLocked
                    ? onOpenPersonalityPaywall
                    : isReferencesLocked
                      ? onOpenReferencesPaywall
                      : isInterviewStep && interviewStatus === "not_started"
                        ? onOpenInterviewStart
                        : isInterviewStep && interviewStatus === "invited"
                          ? onOpenInterviewCheck
                          : undefined
              }
              className={rowClassName}
              style={rowStyle}
            >
              {content}
            </div>
          );
        })}
      </div>

      <button
        onClick={onOpenGenerateReport}
        className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
        style={{ width: "100%", marginTop: 20, background: "none", border: "1px solid rgba(237,26,36,0.4)", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer" }}
      >
        Generate consolidated report
      </button>

      <Link
        href="/hub/account/recruiter-preview"
        className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
        style={{ width: "100%", marginTop: 10, background: "none", border: "1px solid rgba(237,26,36,0.4)", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer", display: "block", textAlign: "center", textDecoration: "none" }}
      >
        Recruiter Preview settings
      </Link>
    </div>
  );
}
