# Candidate Directory + Drill-Down (Slice 3) — Design

**Status:** Approved design, not yet implemented.

## Context

Slice 3 of `plans/2026-08-05-admin-portal-roadmap.md`. Slice 2 (funnel overview) shows aggregate counts only — no way to see *which* candidate is where, or look at their actual reports. This adds a candidate list and a per-candidate detail view under `/admin`.

## Decisions

1. **One row per candidate, not per JD/role.** Candidates can submit multiple `fitment_leads` (multiple JDs). Directory dedupes by `user_id`; a candidate with 3 role submissions is one row. Matches how a PO thinks about "my candidates." Drill-down lists all their roles inside.
2. **`fitment_leads.email` is the email source**, not `auth.admin.listUsers()` — the column already exists (migration 0001), avoids the paginated admin API entirely.
3. **Reuse existing candidate-facing presentational components directly** for fitment report and interview report — `ResumeMatchGauge`, `ResumeMatchCategoryCard`, `CandidateProfile`, `CandidateStatsCard`, `InterviewScoreGauge`, `ParameterScoreTile`, `CriteriaMatchCard`, `SkillReportTable`, `AnswerTranscript`, `RoadmapTimeline`, `EvaluatorNotes`. Confirmed these take plain props with no session/auth coupling — safe to feed admin-fetched data straight in.
4. **Do NOT reuse `PersonalityTestClient` or `ReferencesClient`** — both are full interactive candidate flows (quiz-taking, referee invite/reminder forms) hitting session-scoped APIs that resolve to the *logged-in* user. For an admin viewing another candidate, these would either show the admin's own empty data or let the admin accidentally fire real invite/reminder actions on someone else's reference check. Instead:
   - Personality: reuse `PersonalityReport`, the inner presentational component (`app/hub/account/personality/PersonalityReport.tsx`) — pure props (`candidateName`, `roleTitle`, `scores`, `validity`), `onRetake` optional and omitted here.
   - References: reuse `getReferenceCheckStatus(userId)` (`lib/referenceChecks.ts:193`) — already service-role-based and already takes an explicit `userId`, no changes needed — paired with `computeReferenceReport()`. Rendered with a new small read-only table (name, role, org, ratings, feedback), not `ReferencesClient`.
5. **No multi-role tab switcher.** A candidate with multiple leads shows every role's fitment/interview/personality stacked sequentially on the drill-down page. The proper multi-role switcher UI is still unresolved (memory: `multi_role_switcher_design_decisions`) — not building it here; candidate/role counts are small enough today that a stacked list is fine.

## Architecture

```
lib/
  adminCandidates.ts       # listCandidates(), getCandidateDetail(userId) — service-role, pure aggregation
app/
  admin/
    candidates/
      page.tsx              # directory list
      [userId]/
        page.tsx             # drill-down
        RefereeSummary.tsx    # new small read-only referee table component
```

## Data flow

**`listCandidates()`** — one service-role query per table, grouped/reduced by `user_id`, same query-per-stage pattern as slice 2 (`app/admin/page.tsx`):
- `fitment_leads` (`user_id, email, name, role_title, created_at`): group by `user_id` → `email`, `name`, `latestRoleTitle` (max `created_at` row), `firstSeenAt` (min `created_at`).
- `report_unlocks`, `fitment_interviews` (`status='ready'`), `personality_tests`, `reference_checks` (`status='completed'`): each reduced to a `Set<user_id>`, used to compute the candidate's furthest funnel stage (same 5 stages as slice 2's funnel).

Returns one row per candidate: `{ userId, email, name, latestRoleTitle, firstSeenAt, funnelStage }`, sorted newest-first by `firstSeenAt`.

**`getCandidateDetail(userId)`**:
- All `fitment_leads` rows for this `user_id` (every role).
- Per lead: matching `fitment_interviews` row (`user_id`, `role_title`, `status='ready'`) for interview data.
- Latest `personality_tests` row for the `user_id`.
- `getReferenceCheckStatus(userId)` + `computeReferenceReport()` for references (candidate-level, no role dimension).
- `notFound()` if no `fitment_leads` rows exist for the `userId`.

## Error handling

- Unknown `userId` in URL → `notFound()`.
- Missing report data for a given role (interview not completed, personality not taken) → section shows "not yet completed," not an error and not a redirect (admin is viewing, not doing — the existing candidate pages' `redirect()`-on-missing-data pattern doesn't apply here).

## Explicitly out of scope

- Multi-role tab switcher / per-role visibility controls (roadmap slice 9, still unresolved).
- Search/filter on the directory list — plain sorted list for v1.
- Editing/acting on candidate data from the admin view (read-only throughout).

## Testing

- `lib/adminCandidates.ts`: unit test the funnel-stage aggregation logic (pure function: given rows from each table, compute furthest stage per candidate) — same TDD approach as `lib/adminAuth.ts`.
- Pages: manual verification against real data — matches the existing convention for candidate-facing report pages (`report/page.tsx`, `interview/page.tsx`, etc. have no unit tests either).
