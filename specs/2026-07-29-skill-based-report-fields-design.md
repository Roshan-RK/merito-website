# Merito HUB — Map the Rest of the Skill-Based Interview Report

## Context

`isCriteriaMatch` was flipped back to `false` (skill-based) on 2026-07-29 — skill-based is the mode actually needed, not criteria-based. That reversal exposed how much of the real skill-based report response was never mapped: `getInterviewReport` (`lib/intervuebox/interviewReports.ts`) only ever read `overallReport.{score,metrics,overallSummary,strengths,areasOfImprovement,feedbackToInterviewer,roadmap,criteriaEvaluationTable}` plus `sessionDetails.{flagForSuspiciousActivity,integrityCheck,videoReport,answers[].timestamp}` (the last only to compute `approxDurationMinutes`). Confirmed via a real skill-based sample (Sales interview, captured 2026-07-27) that six more fields exist and are silently dropped: `sessionDetails.skillReport`, `sessionDetails.interviewTitle`, `sessionDetails.overallSkillScore`, `sessionDetails.answers[]` (full per-question transcript + scoring), `overallReport.rank`, `sessionDetails.knowledgeAnswers`.

**Why:** `skillReport` in particular is very likely the actual "skill-wise evaluation" that's been wanted all along — named skills with a score and narrative comment each, closer to that name than criteria-based's job-requirement list ever was.

## Scope

Map, persist, and surface: `skillReport`, `interviewTitle`, `overallSkillScore`, the full `answers[]` transcript. Map and persist only (no UI): `knowledgeAnswers`. Explicitly dropped: `rank` (candidates are isolated per-job, cross-candidate ranking isn't meaningful here).

## Types (`lib/intervuebox/interviewReports.ts`)

```ts
export type SkillReportEntry = { score: number; comment: string };

export type AnswerDetail = {
  question: string;
  transcript: string;
  timestamp: string;
  metrics: {
    score?: number;
    evaluation?: string;
    dynamicSkills: Array<{ skill: string; comment: string }>;
  };
};
```

Add to `InterviewReportReady`:
```ts
interviewTitle: string | null;
skillReport: Record<string, SkillReportEntry>;
overallSkillScore: number | null;
answers: AnswerDetail[];
knowledgeAnswers: unknown[];
```

Add to `RawInterviewReportResponse.sessionDetails`:
```ts
interviewTitle?: string;
skillReport?: Record<string, { score: number; comment: string }>;
overallSkillScore?: number;
knowledgeAnswers?: unknown[];
answers?: Array<{
  question: string;
  transcript: string;
  timestamp: string;
  metrics?: {
    score?: number;
    evaluation?: string;
    dynamicSkills?: Array<{ skill: string; comment: string }>;
  };
}>;
```
(The existing `answers?: Array<{ timestamp: string }>` used only for duration is superseded by this richer type — same field, one definition.)

## Mapping (`getInterviewReport`)

```ts
interviewTitle: response.sessionDetails.interviewTitle ?? null,
skillReport: response.sessionDetails.skillReport ?? {},
overallSkillScore: response.sessionDetails.overallSkillScore ?? null,
knowledgeAnswers: response.sessionDetails.knowledgeAnswers ?? [],
answers: (response.sessionDetails.answers ?? []).map((a) => ({
  question: a.question,
  transcript: a.transcript,
  timestamp: a.timestamp,
  metrics: {
    score: a.metrics?.score,
    evaluation: a.metrics?.evaluation,
    dynamicSkills: a.metrics?.dynamicSkills ?? [],
  },
})),
```
`rank` and `knowledgeAnswers`'s eventual shape: not further processed, `rank` not mapped at all.

## Persistence (`app/api/webhooks/intervuebox/route.ts`)

Add the 5 new fields (all except `rank`, which was never mapped) to the `report_raw` object alongside the existing ones — same flat structure, no new columns.

## UI

**`SkillReportTable.tsx`** (new, `app/hub/account/interview/`) — same row-per-item visual pattern as yesterday's criteria table: skill name (title-cased) + score badge (green/amber/red — a simple threshold, ≥70 green, ≥40 amber, else red, matching `InterviewScoreGauge.tsx`'s existing `getScoreBand` bands) + comment paragraph. Wired into both `interview/page.tsx` and `combined-report/page.tsx`, gated on `Object.keys(skillReport).length > 0`, placed where the criteria table currently sits (same slot — under skill-based, `skillReport` is populated and `criteriaEvaluationTable` is empty; under criteria-based, the reverse. Both blocks stay gated so exactly one shows per interview, no code needed to detect which mode was used).

**`interviewTitle`** — small addition to `interview/page.tsx`'s header area, next to the existing role-title pill, e.g. as muted text underneath.

**`overallSkillScore`** — small labeled stat, not a gauge: a `<p>` reading "Overall skill score: {value}%" near the existing "AI overview" card, both pages, gated on non-null.

**Transcript** (`interview/page.tsx` only) — new `AnswerTranscript.tsx` client component: collapsed by default behind a "View full transcript ({answers.length} questions)" toggle button. Expanded: one block per answer — question text, candidate's `transcript` (or "No answer given." if empty string), and a compact line showing `metrics.score` (if present) + `metrics.evaluation` narrative + `metrics.dynamicSkills` skill tag(s). Not added to `combined-report/page.tsx` (print/PDF context, a large collapsible list doesn't belong there).

**`knowledgeAnswers`** — no UI. Captured in `report_raw` for whenever a populated real example exists to design against.

## Testing

- `lib/intervuebox/__tests__/interviewReports.test.ts` — extend the existing real-payload-shaped test with `skillReport`, `interviewTitle`, `overallSkillScore`, `answers`, `knowledgeAnswers` present in the mock response, asserting they map through correctly; a second case confirming they default to `{}`/`null`/`[]` when absent (mirrors the existing `criteriaEvaluationTable` default-empty test).
- `app/api/webhooks/intervuebox/__tests__/route.test.ts` — extend the existing mocked report to include the new fields, assert they land in the `report_raw` update payload.
- No new component tests (confirmed repo convention: zero test files exist for any `"use client"` component under `app/hub/account/`) — verify visually instead, same approach as yesterday, ideally against a real skill-based interview run since the flag flip (none has completed yet as of this writing).

## Non-goals

- No UI for `knowledgeAnswers` (unconfirmed shape).
- No UI for `rank` (explicitly dropped).
- No per-answer sub-dimension scores (correctness/relevance/communication/problemSolving/confidence) in the transcript view — redundant with the aggregate `skillMetrics` already shown; only `score` + `evaluation` + skill tag shown per question.
- No changes to the combined-report page beyond `skillReport`/`overallSkillScore` (transcript stays interview-page-only).
