# Admin Foundation + Funnel Overview (Slices 1+2) — Design

**Status:** Approved design, not yet planned/implemented.

## Context

No admin/oversight surface exists today — only candidate-facing Supabase auth (`app/hub/login`, magic-link OTP). PO has no way to see signups, test/assessment progress, or drop-off without querying Supabase directly. This is the first two slices of `plans/2026-08-05-admin-portal-roadmap.md` — slice 1 (admin foundation) blocks every other slice; slice 2 (funnel overview) is the direct payoff for the original ask.

Single admin user for now (`roshan@merito.in`) — no roles table, no invite flow.

## Decisions

1. **Reuse existing Supabase magic-link auth**, no new login page/system. Admin signs in at `/hub/login` same as candidates; `/admin/*` routes add an email-allowlist check on top of the existing session.
2. **Email allowlist via env var** (`ADMIN_EMAIL`), not a DB table — single admin, simplest thing that works. Revisit as a table only if slice-1's "small fixed team" path is ever needed.
3. **Service-role client for all admin reads.** Every relevant table has RLS scoped to `auth.uid() = user_id` (confirmed across 11 migrations) — admin needs to see all rows, not just its own. `getSupabaseServerClient()` (`lib/supabase.ts`) already exists for this (service-role key, `persistSession: false`) and is already used elsewhere (`app/hub/account/page.tsx`). Server-only — never imported into client components.
4. **404, not redirect, on wrong-account access.** If a signed-in non-admin hits `/admin`, `notFound()` rather than a "not authorized" page — doesn't reveal the admin area exists to anyone probing while signed in as a candidate.
5. **Funnel starts at "fitment check started," not raw signup.** True zero-activity signups need `supabase.auth.admin.listUsers()` (paginated, no direct total-count field) — deliberately deferred, tracked as roadmap slice 10.

## Architecture

```
lib/
  adminAuth.ts          # requireAdmin() — server-only guard
app/
  admin/
    layout.tsx           # calls requireAdmin(), wraps all admin routes
    page.tsx              # funnel overview (slice 2)
```

`requireAdmin()`:
- `createSupabaseServerClient().auth.getUser()` (cookie-aware, same as `app/hub/account/page.tsx:14-17`)
- no user → `redirect("/hub/login?next=/admin")`
- user, but `user.email !== process.env.ADMIN_EMAIL` → `notFound()`
- user matches → return `user` (available if a page needs it, e.g. for an "admin: you" label)

Missing `ADMIN_EMAIL` env var → throw at request time, matching `getSupabaseServerClient()`'s existing pattern of throwing on missing config (`lib/supabase.ts:11-13`).

## Data flow (slice 2 — `app/admin/page.tsx`, server component)

One service-role query per funnel stage, exact fields confirmed against migrations:

1. Fitment check started — `count(*) from fitment_leads`, distinct `user_id`
2. Report unlocked (paid) — `count(*) from report_unlocks`
3. Interview started — `fitment_interviews` where `status = 'invited'`
4. Interview completed — `fitment_interviews` where `status = 'ready'`
5. Personality completed — `count(*) from personality_tests`
6. References — `reference_checks` grouped by `status` (`initiated` / `in_progress` / `completed` / `cancelled`)

Rendered as a simple stage list with counts — no charting library for this first pass, just numbers. Time-series/drop-off trend is a fast-follow, not blocking.

## Error handling

- No user / wrong email: handled entirely by `requireAdmin()` before any page renders — no error UI needed.
- Missing env var: throws, surfaces as a 500 — acceptable for a single-admin internal tool (same tolerance as existing `lib/supabase.ts` behavior).
- Query failures (Supabase down, etc.): let the error boundary handle it — no bespoke handling for a v1 internal page.

## Explicitly out of scope

- Roles/permissions beyond a single admin email.
- Raw signup count (roadmap slice 10).
- Candidate drill-down, payments oversight, counselling queue, recruiter-preview oversight, extension usage, IntervueBox data (roadmap slices 3–9) — separate specs.
- Charting/trend visualization — plain counts only for v1.

## Testing

- `lib/adminAuth.ts`: unit test all three branches (no user → redirect, wrong email → 404, correct email → passes through) with a mocked Supabase client, matching the existing `__tests__/route.test.ts` convention used throughout the repo.
- `app/admin/page.tsx`: manual verification — counts checked against Supabase table browser for a known test account (`roshanrk2014@gmail.com`, per existing test-email convention).
