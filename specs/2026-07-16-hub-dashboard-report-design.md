# Merito HUB — Phase 2: Dashboard Shell & Detailed Report Unlock

## Context

Phase 0 (anonymous fitment-check lead capture) and Phase 1 (magic-link accounts)
are both shipped and live on `preview`. Phase 1 ends at a deliberately bare
`/hub/account` page — a plain list of claimed scores and a sign-out button,
explicitly built with no dashboard chrome so it wouldn't need to be redone
once a real dashboard existed.

This is that real dashboard's first phase. A full dashboard design reference
exists (`design_handoff_merito_hub/dashboard/Merito HUB Dashboard.dc.html` +
`README.md`, outside this repo) covering the entire authenticated experience:
a 3-pane layout, a 5-step progress rail, a live recruiter-facing profile
preview, and paid unlocks for a detailed report, a personality test, a mock
AI interview, and reference checks, plus a bundle offer and a 1:1 expert
session upsell. That design describes the *end state* of the dashboard, not
a single buildable phase — it doesn't distinguish "build now" from "build
later" the way the project roadmap does.

This phase decomposes that design and builds only its first slice: the
3-pane dashboard shell and the detailed fitment report's paywall + unlock
flow. Personality test, mock interview, reference checks, the live profile
preview, recruiter-visibility toggles, the bundle offer, and the expert
session are all deferred to later phases — the progress rail visually
acknowledges them as "Coming soon" but nothing beyond the report is
functional yet.

## Decisions

- **Pricing follows the design file, not the original brainstorm.** The
  original product vision assumed the first detailed report would be free
  and the personality test would always be free. The design file's Business
  Rules say otherwise: the report is always ₹299 (no first-free
  carve-out), and personality is a ₹299 one-time purchase. The design file
  is treated as the current source of truth — only the raw fitment score
  itself stays free and always visible.
- **No real payment gateway this phase.** The full paywall UI (modal,
  sample panel, pay button, copy) is built to match the design exactly, but
  clicking "pay" fake-unlocks instantly — no charge is made, no gateway is
  integrated. This lets the entire report flow (browse → paywall → unlock →
  see report → persists on reload) be built and demoed now. Wiring a real
  gateway (Razorpay, matching the design's "UPI, card & netbanking" copy)
  is a small, isolated follow-up phase later — the unlock write happens
  through one server-side function (`lib/reportUnlocks.ts`) specifically so
  swapping in a real payment confirmation later touches one place.
- **CV text is now persisted going forward — a reversal of Phase 0's
  "never persist CV" decision.** Phase 0 chose not to store CV content
  because the lead-capture use case didn't need it immediately. Phase 2
  needs it to generate the detailed report on unlock, potentially days or
  weeks after the original anonymous check, without asking the candidate
  to dig their CV out again. Storing parsed CV *text* (never the raw
  file) going forward is a small addition, and it's normal practice for a
  recruitment company's core data. This requires two things ship in the
  same phase: explicit consent copy on the CV upload step, and a real
  `/privacy` page (neither currently exists — the site has no privacy
  policy at all). Leads created before this change has no `cv_text` — the
  unlock flow falls back to asking for a re-upload in that case.
- **The detailed report breakdown is generated lazily, only on unlock.**
  Anonymous checks keep costing one cheap score+verdict Claude call
  (Phase 0's `scoreFitment`, unchanged). The more expensive
  strengths/gaps/CV-fix breakdown only gets generated when someone actually
  unlocks the report — avoiding paying for detailed generation on leads
  that never convert. Once generated, it's persisted (`fitment_reports`)
  so it's never regenerated on a normal page revisit.
- **Entitlement (`report_unlocks`) is per user, per role — matching the
  design's "report is per-role, re-locks on role change" rule.** Changing
  target role re-locks the report for the new role; the old role's unlock,
  if any, is untouched (though there's nothing else to carry over yet,
  since personality/interview/references don't exist this phase).
- **One active target role at a time**, matching the design's single
  role pill in the top bar. The candidate's most recently claimed/checked
  lead becomes the initial target role on first dashboard visit; the
  existing "Change role" flow (already specified in the design doc)
  updates it from then on.
- **The progress rail shows all 5 steps, with 4 marked "Coming soon."**
  This matches the design's visual intent and sets expectations, without
  making the unbuilt steps interactive or showing fake pricing for them.
  The bundle card and expert-session card are omitted entirely this phase
  — both reference paid steps that don't exist yet.
- **Free CV re-check for the same role (already in the design) keeps the
  report unlocked but regenerates its content** against the updated CV,
  so the report stays accurate without re-charging.

## Architecture

- `app/hub/account/page.tsx` is rewritten (replacing Phase 1's bare
  version) as a Server Component shell: resolves the session, the current
  target role (most recent claimed lead, or the role set by a prior
  "Change role" action), the score, `report_unlocks` status for that
  user+role, and the report content from `fitment_reports` if unlocked.
  Passes this down to client islands for the interactive parts.
- New table `report_unlocks` (`user_id uuid references auth.users(id)`,
  `role_title text`, `unlocked_at timestamptz default now()`, unique on
  `(user_id, role_title)`) — the server-backed entitlement record the
  design's State Management section calls for.
- New table `fitment_reports` (`user_id uuid references auth.users(id)`,
  `role_title text`, `strengths text[]`, `gaps text[]`, `cv_fixes text[]`,
  `generated_at timestamptz default now()`, unique on
  `(user_id, role_title)`) — the persisted generated breakdown, so it's
  computed once per user+role and reused on every later visit until a
  free re-check regenerates it.
- `fitment_leads` gains a `cv_text text` column (nullable — old rows stay
  null). Populated going forward at anonymous-check time, alongside the
  existing consent-free fields; the anonymous check form gains a short
  consent line before the CV upload step.
- New `app/privacy/page.tsx` — a real privacy policy page, drafted to
  cover CV/resume data collection and DPDPA-relevant basics (retention,
  what's collected, contact for deletion requests). Flagged for legal /
  Rushikesh review before shipping, same as the design file flags all
  prices as `[CONFIRM]` — this doesn't block building the page and the
  consent flow around it, only publishing final legal-reviewed copy.
- `lib/generateFitmentReport.ts` — new Claude call (Haiku 4.5, matching
  Phase 0's cost-conscious model choice), structured output via the same
  `zodOutputFormat` pattern as `lib/scoreFitment.ts`. Takes JD text + CV
  text + score, returns `{ strengths: string[], gaps: string[], cvFixes:
  string[] }`.
- `lib/reportUnlocks.ts` — server-only helpers using the admin Supabase
  client (bypasses RLS, same privilege pattern as `lib/claimFitmentLeads.ts`):
  `isReportUnlocked(userId, roleTitle)` and `unlockReport(userId,
  roleTitle)`. `unlockReport` is idempotent — safe to call more than once
  for the same user+role without erroring.
- `app/api/hub/unlock-report/route.ts` — `POST` Route Handler. Reads the
  session (cookie-aware client), calls `unlockReport`, then checks for
  `cv_text` on the candidate's claimed lead for the current role. If
  present: calls `generateFitmentReport`, stores the result in
  `fitment_reports`, returns it. If absent: returns a distinct
  "needs re-upload" response so the client can prompt for a CV instead of
  silently failing.
- RLS: both new tables get a `SELECT` policy scoped to `auth.uid() =
  user_id`, matching the pattern already established on `fitment_leads` in
  Phase 1. Inserts/updates only ever happen through the admin client inside
  trusted server code (the unlock route), never exposed to direct
  client writes — same trust model as `claimFitmentLeads`.

## Components

- `app/hub/account/TopBar.tsx` — sticky top bar: logo, red "HUB" badge,
  "Dashboard" label, target-role pill with a "Change" action opening
  `ChangeRoleModal`, initials avatar.
- `app/hub/account/ProgressRail.tsx` — progress ring (% complete: report
  unlocked counts as 1 of 5, the score itself isn't a "step"), "N of 5
  steps complete" text, 5 step rows. Report row is interactive (click
  opens `ReportPaywallModal` if locked, no-ops/shows a checkmark if
  unlocked). The other 4 rows render greyed out with a "Coming soon" tag
  instead of a price, not clickable.
- `app/hub/account/ScoreCard.tsx` — pulsing-dot "YOUR JOB FITMENT SCORE"
  label, score in Gabarito red, optional delta chip if a previous score
  exists, progress bar, "fit for {role}" line. Locked state: red "See my
  detailed report" button + the design's exact microcopy pattern ("Why
  {score}? Your strengths, your gaps, and how to fix your CV — ₹299").
  Unlocked state: two tiles (green "Top strengths", red "Gaps costing you
  shortlists") pulled from `fitment_reports`, "Open full report" link
  expanding the full breakdown inline. Footer: "Upload updated CV" free
  re-check button, opens the CV-only re-check modal (design's "Updated CV"
  flow).
- `app/hub/account/ReportPaywallModal.tsx` — the shared paywall modal
  pattern from the design (overlay, sample panel with blurred/visible bar
  rows, "View full sample" expander, includes list, full-width pay
  button, "One-time payment · No subscription" microcopy), configured
  with the report's exact ₹299 copy. Pay button calls
  `POST /api/hub/unlock-report`; on the "needs re-upload" response, swaps
  the modal content to a CV upload prompt instead of failing silently.
- `app/hub/account/ChangeRoleModal.tsx` — new role text input, JD via the
  same paste/link segmented toggle as the anonymous check, CV upload.
  Submits to a re-scoring flow (reuses Phase 0's `scoreFitment`, stores a
  new `fitment_leads` row for the new role under the same account),
  updates the dashboard's current role, leaves any existing
  `report_unlocks`/`fitment_reports` rows for other roles untouched, shows
  the design's exact carry-over microcopy.
- `app/privacy/page.tsx` — static page, standard layout matching the rest
  of the site (footer/nav already global via `app/layout.tsx`).
- CV upload consent copy added inline to `app/hub/FitmentChecker.tsx`'s
  existing upload step (Phase 0's anonymous-check form) — a short line
  above or below the upload zone, linking to `/privacy`.

## Data Flow

1. Anonymous candidate checks fitment on `/hub`, sees and implicitly
   accepts the new consent copy near the CV upload step. CV text is now
   parsed and **persisted** to `fitment_leads.cv_text` (previously
   discarded after scoring), alongside the existing score/verdict/jd_text
   fields.
2. Candidate signs up; Phase 1's `claimFitmentLeads` attaches the row(s)
   to their account, unchanged.
3. First `/hub/account` visit: the most recently claimed lead's role
   becomes the current target role. Score shows free and unlocked; the
   report row in the rail and the score card both show locked (no
   `report_unlocks` row yet for this user+role).
4. Candidate clicks "See my detailed report" → `ReportPaywallModal` opens
   with the sample panel.
5. Candidate clicks the pay button → `POST /api/hub/unlock-report` →
   `unlockReport` writes the `report_unlocks` row instantly (no real
   charge) → if `cv_text` exists for the claimed lead matching this role,
   `generateFitmentReport` runs and its result is stored in
   `fitment_reports`; if `cv_text` is missing (a pre-migration lead), the
   route returns the "needs re-upload" signal and the modal prompts for a
   CV instead → on success the modal closes, ring/rail/score card update,
   a success toast shows, and the report renders inline.
6. Later visits read `report_unlocks` + `fitment_reports` directly — no
   regeneration, no re-payment, no re-parsing.
7. "Upload updated CV" (free re-check, same role): re-scores via the
   existing scoring path, updates the stored score/delta on the lead row,
   **does not** touch `report_unlocks` (stays unlocked) but does
   regenerate `fitment_reports` so the breakdown stays accurate against
   the new CV.
8. "Change target role": new role/JD/CV submitted, a new `fitment_leads`
   row is created and scored for the new role under this account, the
   dashboard's current role switches to it. This new role has no
   `report_unlocks` row, so the report shows locked again — matching the
   design's per-role re-lock rule. Any unlock for the previous role is
   untouched (nothing to carry over to yet, since only the report exists
   this phase).

## Testing

- `lib/generateFitmentReport.ts` — unit-tested against a mocked Anthropic
  client (same pattern as `lib/scoreFitment.test.ts`): confirms JD text +
  CV text + score in produces a structured `{ strengths, gaps, cvFixes }`
  out, matching the Zod schema.
- `lib/reportUnlocks.ts` — unit-tested against a mocked Supabase admin
  client: `unlockReport` inserts a `report_unlocks` row for a new
  user+role pair; calling it again for the same pair doesn't error and
  doesn't create a duplicate row (idempotent); `isReportUnlocked` reflects
  whatever the mocked client returns.
- `app/api/hub/unlock-report/route.ts` — unit-tested with mocked
  `unlockReport`/`generateFitmentReport`/Supabase read calls: the
  happy path (CV text present) calls `unlockReport` then
  `generateFitmentReport` and returns the report; the missing-CV path
  calls `unlockReport` but not `generateFitmentReport`, and returns the
  distinct "needs re-upload" shape instead of a report.
- Dashboard UI (rail, score card, paywall modal, change-role modal, the
  3-pane → 2-pane → 1-column responsive breakpoints from the design) —
  **no automated tests**, matching Phase 0/1 precedent (no
  component/browser test infrastructure in this repo). Verified manually
  instead: the full flow (free score → paywall → fake-unlock → report
  renders → persists on a hard reload → change-role re-locks it) run live
  against the same real Supabase project used for Phase 1's E2E
  verification, plus a manual pass at all three breakpoints per the
  design's binding mobile spec.
- `app/privacy/page.tsx` — no test, static content.

## Explicit open items (not blocking this spec, but not decided)

1. **Exact privacy policy copy.** A standard DPDPA-flavored draft will be
   written as part of implementation, but final wording needs legal /
   Rushikesh review before the page is considered done, not just built.
2. **Real payment gateway integration (Razorpay, per the design's "UPI,
   card & netbanking" copy).** Explicitly deferred — this phase only
   builds the fake-unlock path behind `lib/reportUnlocks.ts`, chosen
   specifically so a real gateway can be wired in later without touching
   the rest of the dashboard.
3. **Migration story for pre-existing claimed leads with no `cv_text`.**
   The unlock flow's "needs re-upload" fallback handles this at the
   individual-unlock level; no bulk backfill or bulk notification to
   already-signed-up users with old leads is planned this phase.
4. **Personality test, mock interview, references, live profile preview,
   recruiter-visibility toggles, bundle offer, expert session** — all
   fully out of scope for this phase, per the design decomposition above.
   Each becomes its own future phase.
