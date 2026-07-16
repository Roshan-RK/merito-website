# Merito HUB — Phase 2b: Detailed Report Depth Redesign

## Context

Phase 2 (dashboard shell + detailed report unlock) shipped and went through live
end-to-end testing on `preview`. The unlock mechanics all work correctly — the
paywall, the fake-pay flow, entitlement persistence, progress rail updates —
but live testing surfaced a real product problem: the detailed report's actual
*content* is too thin to justify its ₹299 price. The original design
(`lib/generateFitmentReport.ts`, `specs/2026-07-16-hub-dashboard-report-design.md`)
asked Claude for three flat string arrays (`strengths`, `gaps`, `cvFixes`),
rendered as two short paragraphs each in `ScoreCard`'s two-tile summary.
`cvFixes` was generated but never rendered anywhere. The result reads as
generic AI summary text, not a paid analytical product.

This spec redesigns the report's content depth and where it's surfaced,
without touching anything else Phase 2 already shipped and verified — the
paywall, the fake-unlock mechanism, the entitlement model, and the pricing are
all unchanged and not revisited here.

## Decisions

- **Report content becomes a JD-requirement rubric with CV evidence, plus a
  prioritized action plan** — replacing the three flat string arrays. This
  is the combination that makes a report feel worth paying for: the rubric
  makes it feel rigorous (scored against *this* JD's actual requirements,
  not generic advice), the CV evidence quotes make it feel personally
  analyzed (proof, not paraphrase), and the action plan gives the candidate
  something to *do*, which is the actual purchase driver. Longer narrative
  text alone was considered and rejected as the primary fix — it risks
  reading as padded rather than valuable.
- **A new expanded view at `/hub/account/report`** — a dedicated route, not
  a modal — renders the full rubric and action plan. The existing two-tile
  summary in `ScoreCard` becomes a teaser (top 1 "strong" match, top 1
  "missing" gap) linking to this page via "Open full report →". A dedicated
  page reads better than a modal for longer, scrollable analytical content,
  and sets up naturally for a future PDF-export phase.
- **`fitment_reports`' schema changes** — already-live columns
  (`strengths text[]`, `gaps text[]`, `cv_fixes text[]`) are replaced with
  `requirements jsonb` and `action_plan jsonb`. This is a genuine schema
  migration against a table that already has live data from Phase 2's own
  E2E testing; existing rows are not migrated/backfilled — a candidate who
  already unlocked a report under the old schema will need to trigger a
  free CV re-check (which regenerates the report) to get the new shape, or
  will see an empty/broken old row until they do. This gap is accepted
  rather than solved with a backfill script, since this is pre-launch,
  low-volume data.
- **Visual direction: quiet, evidence-led, analytical — not decorative.**
  This is a read-once document a candidate studies carefully, not a
  marketing surface. The one deliberate "signature" design move is the
  CV-evidence-quote treatment (a distinct blockquote-style block with a
  "— from your CV" attribution) — that's the detail that makes the report
  feel like real analysis. Everything else (match-level chips, action-plan
  priority weighting) stays restrained and uses the existing design tokens,
  plus one new addition: a warm amber token for the "partial match" state,
  chosen to stay within the brand's warm-red family rather than introducing
  an off-palette hue like blue or purple.

## Architecture

- `lib/generateFitmentReport.ts` — same file, same Claude Haiku 4.5 call and
  `zodOutputFormat` structured-output pattern, new schema:
  ```ts
  export type FitmentReportResult = {
    requirements: {
      requirement: string;
      matchLevel: "strong" | "partial" | "missing";
      evidence: string;
      note: string;
    }[];
    actionPlan: { priority: number; action: string; why: string }[];
  };
  ```
  `evidence` is a real quote pulled from the candidate's CV text, or the
  literal string `"Not found in CV"` when the requirement has no
  corresponding evidence. `requirement` is one discrete JD requirement the
  prompt asks Claude to parse out of the job description — the schema
  itself is the mechanism that forces per-requirement granularity instead
  of a generic summary.
- Migration `supabase/migrations/0004_fitment_reports_rubric.sql` — alters
  the existing `fitment_reports` table: drops `strengths`, `gaps`,
  `cv_fixes`, adds `requirements jsonb not null default '[]'::jsonb` and
  `action_plan jsonb not null default '[]'::jsonb`. RLS policy (already in
  place from migration `0003`) is unaffected — same `auth.uid() = user_id`
  scoping, no policy change needed since it doesn't reference specific
  columns.
- `app/api/hub/unlock-report/route.ts` — same route, same trust model
  (session client for reads, admin client for the `fitment_reports`
  upsert), only the `generateFitmentReport` call's return shape and the
  upsert payload change (`requirements`/`action_plan` instead of
  `strengths`/`gaps`/`cv_fixes`).
- `app/hub/account/report/page.tsx` — new Server Component. Reads the
  session, resolves the current target role the same way
  `app/hub/account/page.tsx` already does (most recent claimed
  `fitment_leads` row), checks `isReportUnlocked` — redirects to
  `/hub/account` if not unlocked — then reads the full `fitment_reports`
  row for that user+role via the RLS-scoped session client and renders it.

## Components

- `app/hub/account/report/page.tsx` — single-column reading layout, max
  width ~820px centered (matching the reading-width pattern already
  established on `/privacy`), not the 3-pane dashboard grid. Minimal header
  (role + score, small — this page is read *after* the candidate already
  knows their score from the dashboard, so it doesn't need to re-sell it),
  then a "Match breakdown" section listing every `requirements` entry (not
  just the teaser's top 2), then a "Your action plan" section listing
  `actionPlan` in priority order. A "← Back to dashboard" link at the top.
- `app/hub/account/report/RequirementRow.tsx` — one row per requirement,
  rendered as a single card (no nested cards): a match-level chip (Strong
  = existing green `#16803c` text on `#eefdf1` background; Partial = new
  amber token, `#b45309` text on `#fef3e2` background; Missing = existing
  red `#ed1a24` text on `#fdeced` background) next to the requirement text
  on one line; below that, the evidence rendered as a distinct blockquote
  block (left border accent in the row's match-level color, tinted
  background, small italic text, "— from your CV" label under it) or, when
  `evidence === "Not found in CV"`, a plain muted line instead of a fake
  quote block; below that, the `note` as normal body text.
- `app/hub/account/report/ActionPlanItem.tsx` — one row per action item,
  priority-ordered. Priority is expressed visually, not just numerically: a
  circular badge (filled red, larger, for priority 1; outlined, smaller,
  muted gray for lower priorities) next to the `action` headline, with
  `why` as a smaller sub-line beneath it.
- `app/hub/account/ScoreCard.tsx` (modified) — the existing two-tile
  strengths/gaps summary is replaced with a teaser pulling the first
  `requirements` entry with `matchLevel === "strong"` and the first with
  `matchLevel === "missing"` (falling back gracefully to whatever's
  available if one side is empty), rendered as compact chip-style rows
  rather than full paragraphs, plus an "Open full report →" link to
  `/hub/account/report`. The component's prop shape changes from
  `report: { strengths, gaps, cvFixes } | null` to
  `report: FitmentReportResult | null`.

## Data Flow

1. Candidate clicks the pay button in `ReportPaywallModal` (unchanged UI,
   unchanged fake-unlock mechanism) → `POST /api/hub/unlock-report`
   (unchanged endpoint, unchanged entitlement-write-then-generate order) →
   `generateFitmentReport(jdText, cvText, score)` now returns
   `{requirements, actionPlan}` → upserted into `fitment_reports`'s new
   `requirements`/`action_plan` jsonb columns.
2. The modal's `onUnlocked(report)` callback now receives the new shape;
   `DashboardClient` stores it in state exactly as before, just with the
   new type — `ScoreCard` renders the new teaser from it immediately,
   without a page reload.
3. Clicking "Open full report →" navigates to `/hub/account/report`, which
   independently re-reads `fitment_reports` via the session client (not
   relying on client-side state — a fresh page load, direct link, or
   returning later all work identically) and renders the full breakdown.
4. A free CV re-check (existing, unchanged trigger) still regenerates
   `fitment_reports` for the same role — same trigger, new shape, and this
   is also how an old row (from before this schema change) gets upgraded
   to the new format if a candidate re-checks.
5. Visiting `/hub/account/report` directly while unauthenticated or while
   the report isn't unlocked for the current role redirects to
   `/hub/account` — defense-in-depth, matching the existing account page's
   own redirect-on-no-session pattern.

## Testing

- `lib/generateFitmentReport.ts` — existing unit test file updated: the
  mocked Claude response and assertions change to the new
  `{requirements, actionPlan}` shape; add a case confirming `matchLevel`
  values are constrained to the three valid strings via the Zod schema
  (an invalid value in the mocked response should fail parsing).
- `app/api/hub/unlock-report/route.ts` — existing test file's mocked
  `generateFitmentReport` return value and the assertion on the
  `fitment_reports` upsert payload both update to the new shape
  (`requirements`/`action_plan` keys instead of
  `strengths`/`gaps`/`cv_fixes`). The route's control flow (session vs.
  admin client usage, unlock-before-generate ordering, the `needs_cv`
  branch) is unchanged and its existing test coverage for those branches
  stays valid without modification.
- `app/hub/account/report/page.tsx`, `RequirementRow.tsx`,
  `ActionPlanItem.tsx`, and the modified `ScoreCard.tsx` — no automated
  tests, matching this project's established precedent (no
  component/browser test infrastructure). Manual verification: unlock a
  report live, confirm the teaser shows one strong/one missing match,
  click through to `/hub/account/report`, confirm every requirement row
  renders with its evidence quote (or the "not found" fallback) and
  correct match-level chip color, confirm the action plan is
  priority-ordered with visually decreasing weight, confirm direct
  navigation to `/hub/account/report` while locked redirects to
  `/hub/account`.

## Explicit open items (not blocking this spec, but not decided)

1. **No backfill for reports generated under the old schema.** A candidate
   who unlocked before this change ships will need a free CV re-check to
   get the new format; until then their `/hub/account/report` page would
   read an empty/stale `requirements`/`action_plan` (defaulted to `[]` by
   the migration). Given this is pre-launch with only test data, this is
   accepted rather than solved now — revisit if real paying users exist
   before this ships.
2. **The amber "partial match" token (`#b45309` / `#fef3e2`) is a new
   addition to the design system**, not pulled from the existing dashboard
   design reference (which didn't need a third match-state color). Treated
   as a reasonable, on-brand extension rather than a deviation requiring
   sign-off, but flagged here for visibility.
