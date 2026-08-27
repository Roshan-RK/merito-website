import type { CandidateLevel } from "@/lib/razorpay/pricing";
import { durationForLevel } from "@/lib/intervuebox/agents";

// The interview panel's five candidate-facing statuses (the DB
// fitment_interviews.status values plus the synthetic "not_started"). Shared
// by the client ProgressRail and the *server* interview report page, so it
// has to live outside a "use client" module -- a server component can render
// a client component but cannot call a function exported from one.
export type InterviewStatus = "not_started" | "invited" | "terminated" | "stuck" | "ready";

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
