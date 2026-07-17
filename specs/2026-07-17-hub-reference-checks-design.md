# Merito HUB — Reference Checks

## Context

`ProgressRail.tsx` already lists "Reference checks" as a `isComingSoon` step
in the candidate dashboard, and `app/hub/page.tsx`'s `OFFERINGS` list
describes it as: *"Invite managers, teammates, or clients to rate your soft
skills across parameters. Verified, structured references that carry the
kind of credibility a CV never can."*

A feature matching this description — **RefTrack** — already exists and is
production-proven in the sister repo `merito-ats-prd` (Django/DRF backend +
React frontend). It is recruiter-initiated there: gated per-client
(`Client.ref_track_enabled`), tied to a `CandidateSubmission` in a hiring
pipeline, and used as a hard gate before a candidate can be marked HIRED.

Hub is a different product shape: B2C, self-service, candidate-initiated,
no recruiter/client/submission entities — identity is just `auth.users`,
context is a freeform `role_title` string on a `fitment_leads` row. There is
no shared runtime between the two repos (no ORM, no Python in Hub; Hub is
Next.js + Supabase).

This spec covers porting RefTrack's *reference-gathering mechanic*
(candidate invites referees by email, referees rate 7 categories via a
magic-link form, check completes at a threshold) into Hub, reimplemented
natively — not calling into the ATS backend.

## Decisions

- **Reimplement natively in Hub**, not a call to the ATS Django API. Hub's
  candidate-initiated, un-gated flow doesn't fit RefTrack's
  client/submission-gated model, and a cross-repo runtime dependency adds
  deploy coupling neither repo currently has. RefTrack's *data shapes and
  rubric* are reused as a design reference; its Python code is not reused.
- **Ship free, no paywall for this phase.** `reference_checks` /
  `referees` rows are created and the flow works end-to-end without a
  payment event. Paywall gating (matching the `report` step's ₹299 pattern)
  is an explicit future phase, not built now. `ProgressRail`'s `references`
  step becomes a normal (non-`isComingSoon`) step once this ships.
- **Keyed off `user_id` only**, not `(user_id, role_title)` like
  `fitment_reports`/`report_unlocks`. One active reference check per
  candidate account, independent of which role they were evaluated against
  — referees speak to the person, not a specific JD match.
- **Referee table is named `referees`, not `references`.** `references` is
  a reserved SQL keyword (used in foreign-key syntax) — using it as a table
  name would force quoting on every query and is an easy source of bugs.
- **Same 7-category rubric as RefTrack**: knowledge-application, initiative,
  teamwork, communication, discipline, problem-solving, leadership-skills.
  1–5 scale per category, matching `FeedbackCategory` in
  `backend/references/models.py`. Marketing copy on `app/hub/page.tsx` that
  currently says "5-6 parameters" gets corrected as part of this work.
- **Same thresholds as RefTrack defaults**: minimum 3 completed references
  to mark a check `completed`, maximum 10 referee slots.
- **MVP scope = core loop + reminders + decline.** Invite → referee rates →
  threshold reached → check completes, plus: referees who don't respond get
  auto-reminded (max 3 attempts), and referees can decline instead of
  rating (frees the candidate to invite someone else). Explicitly deferred:
  PDF report export (RefTrack uses Playwright; no equivalent needed yet —
  Hub can render the report in-page), single-use token hardening beyond a
  basic `used_at` check, any recruiter/admin-facing view (Hub has no
  recruiter role).
- **Tokens are opaque, DB-backed, not signed JWTs.** Hub has no existing
  JWT/signing infra; a `reference_tokens` table (random token, `expires_at`,
  `used_at`) matches the row-based pattern already used by
  `report_unlocks`/`fitment_leads`, and gives straightforward revoke/audit
  without adding a new dependency or secret to manage.
- **Reminders need new infra: Vercel Cron.** Nothing in Hub today runs on a
  schedule. A daily cron hitting `/api/hub/references/reminder-sweep`
  (protected by Vercel's cron-secret header convention, not user auth)
  finds stale `pending` references and re-sends. This is the one genuinely
  new piece of infrastructure this feature requires.
- **Email via existing `resend` package**, inline HTML templates following
  the `escapeHtml` + plain-string pattern already used in
  `app/api/contact/route.ts` — no template-DB layer like ATS's
  Django-templated `communications` app.

## Data model

New migration `supabase/migrations/0006_reference_checks.sql`:

```sql
create type reference_check_status as enum ('initiated', 'in_progress', 'completed', 'cancelled');
create type reference_status as enum ('pending', 'completed', 'rejected');
create type referee_experience_level as enum ('fresher', 'experienced');

create table reference_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  status reference_check_status not null default 'initiated',
  min_references int not null default 3,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index reference_checks_one_active_per_user
  on reference_checks (user_id) where status in ('initiated', 'in_progress');

create table referees (
  id uuid primary key default gen_random_uuid(),
  reference_check_id uuid not null references reference_checks(id),
  name text not null,
  email text not null,
  phone text,
  linkedin_url text,
  organization text,
  experience_level referee_experience_level,
  role text not null,        -- faculty|classmate|internship-colleague|internship-manager|manager|team-lead|teammate|client|other
  custom_role text,
  ratings jsonb,              -- [{category, value 1-5}] x7, null until submitted
  overall_feedback text,
  status reference_status not null default 'pending',
  reminder_count int not null default 0,
  feedback_opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reference_check_id, email)
);

create table reference_tokens (
  token text primary key,     -- random 32-byte hex, generated server-side
  reference_id uuid not null references referees(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
```

RLS: `reference_checks` and `referees` — user can select/insert/update
rows where `user_id` (directly, or via `reference_check_id` join) matches
`auth.uid()`. `reference_tokens` — no client-side policy at all; only the
service-role client (route handlers) reads/writes it, mirroring how
`report_unlocks` writes go through `lib/reportUnlocks.ts` today.

## API routes

All under `app/api/hub/references/`:

- `POST /initiate` — auth'd. Creates a `reference_checks` row. Guard: 409 if
  an active (`initiated`/`in_progress`) check already exists for this user.
- `POST /add-referee` — auth'd. Validates against the 10-slot max, inserts a
  `referees` row, generates a token in `reference_tokens`
  (`REFERENCE_FEEDBACK_LINK_VALIDITY` env var, default 14 days), sends the
  invite email via Resend.
- `GET /status` — auth'd. Returns the check plus all `referees` rows
  (name, status, reminder_count) for the dashboard list view.
- `POST /resend-invite` — auth'd. Re-sends the invite email for a specific
  referee, reusing or regenerating the token if expired.
- `POST /send-reminder` — auth'd (or folded into the cron sweep — see
  below). Increments `reminder_count`, sends reminder email. Capped at 3;
  no-ops past that.
- `GET /feedback/[token]` — public. Validates token (`expires_at` not
  passed, `used_at` null); returns referee + candidate name for the form,
  or an error state (expired/used/not found).
- `POST /feedback/[token]` — public. Accepts either `{ ratings,
  overall_feedback }` (marks `referees.status = completed`) or
  `{ declined: true }` (marks `rejected`). Marks the token `used_at` on
  either path (single-use). After a completing submission, recomputes
  `completed_count` on the parent check; if it has reached `min_references`,
  flips `reference_checks.status` to `completed` and sets `completed_at`.
- `POST /reminder-sweep` — cron-only (checked via Vercel's
  `Authorization: Bearer $CRON_SECRET` convention, not user session). Scans
  `referees` where `status = 'pending'`, `reminder_count < 3`, and
  `created_at`/last-reminder timestamp older than N days; sends reminder,
  increments count.

Token generation/validation lives in a shared `lib/referenceTokens.ts`
(`crypto.randomBytes(32).toString('hex')`, stored as-is since it's
DB-guarded and single-use rather than a long-lived secret — no hashing
needed given the threat model matches `report_unlocks`' existing bar).

## UI

- `app/hub/account/references/page.tsx` — server component. Shows current
  check status, list of referees with per-row status badges
  (pending/completed/rejected), "add referee" form (name/email/phone/
  organization/relationship-role), resend/remind buttons. Follows the
  existing `DashboardClient.tsx` shell + card style
  (`ProgressRail.tsx`/`ScoreCard.tsx` visual language: white cards,
  `--font-poppins`, `#ed1a24` accent).
- `app/hub/references/feedback/[token]/page.tsx` — public, unauthenticated.
  Referee-facing rating form: 7 categories × 1–5 stars/scale, free-text
  feedback, plus a "decline" action. First public-token-gated page in Hub
  (no equivalent exists yet); built with the same `zod` validation pattern
  used elsewhere, no `react-hook-form` (not currently a Hub dependency).
- `ProgressRail.tsx` — `references` leaves the `isComingSoon` set; becomes
  clickable, marked done when `reference_checks.status === 'completed'`,
  linking to `/hub/account/references`.
- `app/hub/page.tsx` `OFFERINGS` — copy correction ("5-6 parameters" → "7
  parameters", or de-numbered) and removal of any "coming soon" framing for
  this item once live.

## Explicitly out of scope (this phase)

- PDF export of the reference report.
- Payment/paywall gating.
- Any recruiter, client, or admin-facing view.
- Cross-repo integration with the ATS (`merito-ats-prd`) — no shared DB,
  no API calls between the two systems.
- Reference-check re-initiation flow (starting a second check after the
  first completes/cancels) — one active check per user for now, per the
  unique index above.
