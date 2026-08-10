# Interview status messaging — design

**Date:** 2026-08-10
**Status:** Approved, ready to build

## Problem

`fitment_interviews.status` only has `invited` / `ready` (see `not_started` derived when no row exists). The dashboard's `ProgressRail` shows a flat "Processing" badge for the entire `invited` window — a candidate who just got the invite email and a candidate whose interview finished ten minutes ago look identical. The row is also not clickable while `invited`, so a candidate who wants to recheck "did I actually get the email?" has no way back into that information.

IntervueBox's API gives no real signal for "candidate started/finished the interview" distinct from "report is ready" — confirmed live this session: the dashboard's webhook Test button only ever returns a synthetic stub (`{"test":true,...}`) regardless of which event is selected, and the report-generation trigger endpoint (`POST /public/reports/interviews/generate`) 403s on our current API key (missing `GENERATE_AI_INTERVIEW_REPORT` scope). No new DB state or webhook parsing is buildable against real data today.

## Decision

Add a **client-computed sub-label**, not a new DB status, using elapsed time since invite vs. the known interview slot duration (`durationForLevel`, 30 or 45 min).

| DB status | Elapsed since invite | Badge | 
|---|---|---|
| (no row) | — | price badge, unchanged |
| `invited` | < slot duration | "Invited — check your email" |
| `invited` | ≥ slot duration | "Generating report" |
| `ready` | — | "View report" (unchanged) |

Non-goal: this is a heuristic, not a real signal. A candidate who hasn't opened the email yet will still show "Generating report" once the duration elapses. Acceptable — better than a flat "Processing" for the whole window, and costs nothing to ship. Revisit once IntervueBox grants the missing API scope or confirms the real `ApplicantAIInterviewStatusChanged` webhook payload shape (tracked separately, not blocking).

## Changes

**Data flow:** `app/hub/account/page.tsx`'s interview-row query adds `created_at` to its `select` (currently omitted) → passed down as a new `interviewInvitedAt: string` prop through `DashboardClient` → `ProgressRail`. `ProgressRail` already receives `level`, so it computes `durationForLevel(level)` itself (needs a new import from `@/lib/intervuebox/agents`).

**Badge logic (`ProgressRail.tsx`):** replace the single `interviewStatus === "invited"` badge branch with two branches keyed on elapsed time (computed via `Date.now() - new Date(interviewInvitedAt).getTime()` vs. `durationForLevel(level) * 60_000`).

**Click behavior:** the interview row becomes clickable in both `invited` sub-states (currently dead — `isClickable` excludes it). Clicking calls a new `onOpenInterviewCheck` callback (separate from `onOpenInterviewStart`, which is only for `not_started`).

**Modal (`InterviewPaywallModal.tsx`):** add an optional `alreadyInvited?: boolean` prop. When true, the modal skips straight to the existing "Check your email" confirmation view (same JSX already used post-payment) instead of the payment screen. Copy stays the same as the existing confirmation text — no separate "generating" copy variant in the modal itself, since the badge already communicates that distinction and duplicating it risks the two drifting out of sync.

**`DashboardClient.tsx`:** new `onOpenInterviewCheck` handler opens the same `"interview"` modal state but passes `alreadyInvited` through.

## Out of scope

- No new page/route — `/hub/account/interview` stays the post-ready report view only.
- No DB migration — `fitment_interviews.status` keeps its two real values.
- No change to the existing self-heal poll (`app/api/hub/interview/status/route.ts`, `DashboardClient`'s 15s interval) — orthogonal to the label change.

## Testing

- `ProgressRail` unit test: badge label at elapsed < duration vs. ≥ duration, for both `entry`/`mid` (30min) and `senior` (45min) levels.
- `InterviewPaywallModal` unit test: `alreadyInvited=true` renders the confirmation view immediately, no payment screen.
- Existing `route.test.ts` / `jobs.test.ts` suites unaffected (no API contract change).
