# Merito HUB — Phase 2c: Detailed Report Value & Structure Redesign

## Context

Phase 2b (`specs/2026-07-16-hub-report-depth-redesign-design.md`) shipped a
JD-requirement rubric with CV evidence quotes and a prioritized action
plan, replacing the original thin 3-array report. Live testing of that
build surfaced a new problem: the prompt's instruction to "cover every
distinct requirement" produced 21 flat rows for a real JD — most of them
low-value boilerplate ("Docker/Kubernetes (Nice to have)", "GraphQL (Nice
to have)") sitting at the same visual weight as core requirements, with
no summary, no grouping, and no narrative framing. The page technically
worked (all Phase 2b review gates passed, live E2E confirmed correct
rendering) but read as an undifferentiated wall of near-identical cards.

Separately, the user articulated a product goal for this page beyond
"list the facts": the report should feel like something a candidate would
*want* to show a recruiter — a credibility artifact, not a private
gap-audit. This does NOT mean building an actual sharing feature or a
redacted/positive-only variant in this phase — the user was explicit that
the candidate-facing report must stay fully transparent (all gaps shown,
nothing hidden), and that a filtered, positive-only recruiter-facing
version is a genuinely separate future feature. This phase's job is
narrower: make the *existing* private, fully-transparent report feel like
a considered, structured document instead of a raw list dump.

## Decisions

- **Full transparency is preserved.** Every requirement — strong,
  partial, or missing, must-have or nice-to-have — still appears
  somewhere on the page. Nothing is hidden or filtered out. The fix for
  "looks bad" is structure and framing, not omission.
- **Group by category, not a flat list.** Requirements are bucketed into
  four fixed categories (Technical Skills, Experience, Tools & Platforms,
  Soft Skills) at generation time, each with a matched/total count. This
  replaces the flat 21-row list with four scannable sections, each
  carrying its own mini-signal ("5 of 6 matched") before the reader drills
  into individual rows.
- **A one-paragraph verdict summary leads the page.** A synthesized,
  narrative assessment — the "read this first" line — generated
  specifically to give the page an opening the way a real assessment
  document would, rather than starting cold on a data table.
- **Must-have vs. nice-to-have is a per-row tag, not a second grouping
  axis.** Layering must-have/nice-to-have grouping on top of category
  grouping would create a two-dimensional structure that's harder to scan,
  not easier. Each requirement row instead carries a small "Must-have" /
  "Nice-to-have" tag alongside its match-level chip, so the distinction is
  visible without adding another layer of sections.
- **Every requirement gets an "interview note," not just the gaps.** The
  Phase 2b design's `note` field explained the assessment; this phase adds
  a second field specifically about how to *talk about* that requirement
  in an interview — for a strong match, how to emphasize it; for a gap,
  how to address it if asked. This is what turns the report from "here's
  your score" into "here's what to say," which is the actual value driver
  the user identified.
- **Action plan items get an effort tag** (`quick` / `moderate` /
  `long-term`), so the candidate can triage what's fixable before their
  next application versus what's a longer-term development area.
- **A document-style header, including the candidate's name.** This
  requires a new `name` field that doesn't exist anywhere in the current
  data model — the anonymous check flow only ever collected email. A
  `name` input is added to the existing anonymous check form
  (`FitmentChecker.tsx`), alongside email, and stored in a new
  `fitment_leads.name` column (nullable — old rows without a name fall
  back to showing the email instead in the header).
- **Print-friendly styling was explicitly considered and declined** for
  this round — the user selected category grouping, effort estimates, and
  interview notes, not print styling. Not blocking, just not in scope
  here.
- **The positive-only, recruiter-facing shareable version remains an
  explicit future phase**, not built now. This spec's "share-worthy"
  framing is about the private report's own credibility and structure,
  not a new sharing mechanism.

## Architecture

- `lib/generateFitmentReport.ts` — schema and prompt redesigned again
  (third iteration): adds `verdictSummary`, restructures `requirements`
  into `categories` (each with `category`, `matchedCount`, `totalCount`,
  and its `requirements` array), adds `isMustHave` and `interviewNote` to
  each requirement, adds `effort` to each action plan item. Same Claude
  Haiku 4.5 + `zodOutputFormat` pattern as before — only the schema and
  prompt text change.
- Migration `supabase/migrations/0005_fitment_reports_categories.sql` —
  alters the already-live `fitment_reports` table again: adds a new
  `verdict_summary text` column. The `requirements`/`action_plan` jsonb
  columns' nested *shape* changes (category-grouped structure, added
  `isMustHave`/`interviewNote`/`effort` fields) but Postgres jsonb doesn't
  enforce nested shape, so no column-level migration is needed for that
  part — only application-level Zod validation and TypeScript types
  change (Task 2). Additionally: `alter table fitment_leads add column if
  not exists name text` (nullable).
- `app/api/hub/fitment-check/route.ts` and `app/api/hub/rescore-role/route.ts`
  (via its delegation to `fitment-check`) — both need to accept and store
  the new `name` field on insert, alongside the existing `email`.
- `app/hub/FitmentChecker.tsx` — gains a "Full name" text input above or
  alongside the existing email input.
- `app/api/hub/unlock-report/route.ts` — its `fitment_reports` upsert
  payload gains `verdict_summary` alongside the existing
  `requirements`/`action_plan` jsonb columns.
- `app/hub/account/report/page.tsx` — restructured to render: header
  (name-or-email, role, date, small Merito logo) → verdict paragraph →
  category sections (each rendering its own `RequirementRow`s, grouped) →
  action plan (unchanged position, `ActionPlanItem` gains the effort tag).

## Components

- `app/hub/account/report/RequirementRow.tsx` (modified) — gains a
  must-have/nice-to-have tag (small text label, not a colored chip — kept
  visually secondary to the match-level chip which remains the primary
  signal) and an `interviewNote` block, styled distinctly from the
  existing evidence blockquote (e.g., a labeled "How to talk about this"
  line) so the two kinds of supporting text — CV evidence vs. interview
  coaching — are visually distinguishable, not stacked identically.
- `app/hub/account/report/CategorySection.tsx` (new) — wraps one category:
  a header row with the category name and a small "5 of 6 matched"
  fraction/mini-bar, then its `RequirementRow`s.
- `app/hub/account/report/ActionPlanItem.tsx` (modified) — gains a small
  effort tag (e.g., "Quick fix" / "Takes practice" / "Long-term") next to
  the existing priority badge.
- `app/hub/account/report/page.tsx` (rewritten) — new header block with
  name/email fallback, role, formatted date, and the site's existing
  logo asset; verdict paragraph rendered as a distinct lead-in block
  before the category sections.
- `app/hub/FitmentChecker.tsx` (modified) — new "Full name" input,
  matching the existing email/role input styling exactly (same border,
  radius, font-size as the adjacent fields).

## Data Flow

1. Anonymous check on `/hub` now collects name alongside email/role/JD/CV.
   `fitment_leads.name` is stored on insert (nullable — if left blank,
   stays null, header falls back to email later).
2. Report unlock (`POST /api/hub/unlock-report`, unchanged trigger and
   entitlement mechanics) calls the redesigned `generateFitmentReport`,
   which now returns `{verdictSummary, categories, actionPlan}`. This is
   upserted into `fitment_reports` (`verdict_summary` new column,
   `requirements`/`action_plan` same columns holding the new nested
   shapes).
3. `/hub/account/report` reads the current lead's `name` (falling back to
   the account's email if null) alongside the existing role/score read,
   and the full `fitment_reports` row, rendering the new header, verdict
   paragraph, category-grouped requirements, and effort-tagged action
   plan.
4. A free CV re-check (existing trigger, unchanged) regenerates the report
   under this new schema — same mechanism Phase 2b already established
   for schema migrations without a backfill.

## Testing

- `lib/generateFitmentReport.ts` — existing test file updated again: mock
  response and assertions change to the new
  `{verdictSummary, categories, actionPlan}` shape, including at least one
  category with `matchedCount`/`totalCount` and at least one requirement
  with `isMustHave`/`interviewNote` populated.
- `app/api/hub/unlock-report/route.ts` — existing test's mocked
  `generateFitmentReport` return value and the upsert assertion update to
  include `verdict_summary` in the payload.
- `app/api/hub/fitment-check/route.ts` — existing test updated to assert
  `name` is included in the insert payload when provided, and that
  submission still succeeds when `name` is omitted (nullable, not
  required — matches the spec's "old rows fall back gracefully" decision
  applied prospectively: a candidate skipping the name field shouldn't be
  blocable at submission time).
- `RequirementRow.tsx`, `CategorySection.tsx`, `ActionPlanItem.tsx`,
  `app/hub/account/report/page.tsx`, `FitmentChecker.tsx`'s new field —
  no automated tests, matching this project's established precedent.
  Manual verification: submit a fresh anonymous check with a name filled
  in, confirm it's stored; unlock the report, confirm the header shows
  the name, the verdict paragraph reads as a coherent summary (not a
  template fragment), all four categories render with correct
  matched/total counts, every requirement row shows its must-have/
  nice-to-have tag and an interview note distinct from its evidence
  quote, and the action plan shows effort tags.

## Explicit open items (not blocking this spec, but not decided)

1. **The positive-only, recruiter-facing shareable report** remains fully
   out of scope — noted here again for continuity since it was the
   original framing that led to this spec, but this phase does not build
   any sharing mechanism, redaction logic, or public-facing view.
2. **Print-friendly styling** was considered and explicitly declined for
   this round by the user — worth revisiting if the recruiter-facing
   phase above ever gets scheduled, since printability matters more once
   sharing is a real use case.
3. **No backfill for `fitment_reports` rows generated under Phase 2b's
   flat-list schema or for `fitment_leads` rows with no `name`** — both
   follow the same "regenerate/re-check to upgrade" pattern already
   established and accepted in Phase 2b.
