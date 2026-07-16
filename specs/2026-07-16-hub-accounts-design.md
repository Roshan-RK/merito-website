# Merito HUB — Phase 1: Accounts (Signup / Login)

## Context

Phase 0 (anonymous fitment-check lead capture) shipped and is live on `preview`
(see `specs/2026-07-15-hub-fitment-lead-capture-design.md` and
`plans/2026-07-15-hub-fitment-lead-capture-plan.md`). It added a
`fitment_leads` Supabase table (email, role_title, jd_text, jd_source, score,
verdict, created_at — no CV content), a real Claude-backed scoring endpoint,
and a working (if fake-scored-no-more) `FitmentChecker` on `/hub`.

This is **Phase 1** of the same product buildout: giving candidates an
account, so the score they got anonymously in Phase 0 can follow them into a
real, authenticated experience. Phase 2 (detailed fitment report + free
personality test in a dashboard), Phase 3 (payments, mock AI interview,
reference checks), and Phase 4 (shareable PDF export) all depend on accounts
existing first — nothing in those phases is buildable without this.

Architecture already settled (carried over from Phase 0's brainstorm, not
re-litigated here): everything lives in this one Next.js 15 App Router repo,
one Vercel deployment, no separate service, no subdomain split.

## Decisions

- **Auth method: magic link (passwordless email) only**, via Supabase Auth.
  No password to manage, no breach liability from stored password hashes.
  Signup and login collapse into one action — a single "continue with
  email" form; Supabase creates the account on first use or logs an
  existing user in on repeat use. Google OAuth, email+password, and any
  other method are explicitly out of scope for this phase.
- **Session strategy: `@supabase/ssr`**, the standard cookie-based session
  package for Supabase Auth in Next.js App Router — used across Server
  Components, Route Handlers, and `middleware.ts`. Not treated as an open
  design question; it's the established way to do this.
- **Claim logic runs in application code**, not a database trigger — a
  plain, unit-testable `lib/claimFitmentLeads.ts` function invoked from the
  auth callback route, matching Phase 0's convention of keeping logic in
  testable `lib/` modules rather than SQL.
- **Claiming, at the data level:** a nullable `user_id` column is added to
  the existing `fitment_leads` table (`references auth.users(id)`).
  Claiming is `UPDATE fitment_leads SET user_id = X WHERE email = Y AND
  user_id IS NULL` — no new table, no data duplication.
- **All matching pre-signup checks are claimed, not just the most recent.**
  This was an explicit open item deferred from Phase 0's spec; resolved
  here as "claim everything matching the email" — simpler query, and more
  data on first login is never a downside.
- **Phase 1 ships no dashboard UI.** After login, the candidate lands on a
  bare, unstyled confirmation page (`/hub/account`) showing their claimed
  score(s) and a sign-out button. The real 3-pane dashboard (progress rail,
  paywall modals, live profile preview) from the existing design prototype
  is explicitly Phase 2's job, once there's a detailed report and a
  personality test to actually put in it. Building dashboard chrome now,
  with nothing behind it, would likely be redone.
- **The two dead "create a free account" CTAs already in
  `app/hub/FitmentChecker.tsx`** (in the sample/empty state and the
  post-score state) become real `<Link href="/hub/login">`s as part of
  this phase — not a separate follow-up.
- **Two Supabase clients, least-privilege by default.** Phase 0's
  `lib/supabase.ts` exports an admin client (service-role key, bypasses
  Row-Level Security) — correct for a trusted server-side lead insert,
  wrong for anything reading a logged-in user's own data. Phase 1 adds a
  second, cookie-aware client (anon key, RLS-enforced) for user-facing
  reads, plus an RLS policy on `fitment_leads` restricting `SELECT` to
  `user_id = auth.uid()`.

## Architecture

- New Supabase Auth usage: magic link / OTP via
  `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`
  on the client, and `supabase.auth.exchangeCodeForSession(code)` on the
  server in the callback route.
- New migration: `supabase/migrations/0002_fitment_leads_user_id.sql` —
  adds the nullable `user_id uuid references auth.users(id)` column to
  `fitment_leads`, an index on it, and the RLS `SELECT` policy described
  above. RLS must be explicitly enabled on the table (`alter table
  fitment_leads enable row level security`) since Supabase leaves it off
  by default — this migration is where that happens for the first time,
  since Phase 0's inserts went through the RLS-bypassing admin client and
  never needed it enabled.
- `middleware.ts` at the repo root — runs on requests to `/hub/account`
  (and is written generically so future protected routes, e.g. a Phase 2
  dashboard, can be added to its matcher without rewriting it). Uses the
  cookie-aware client to check for a session; no session → redirect to
  `/hub/login`.
- The claim function (`lib/claimFitmentLeads.ts`) uses the **admin**
  client, and is only ever invoked from the trusted, server-side auth
  callback route — never exposed as a general-purpose endpoint. This
  avoids needing a separate RLS `UPDATE` policy for the claim operation
  itself, since it's a one-time system action, not a user-initiated write.

## Components

- **`app/hub/login/page.tsx`** — client component. One email input, "Send
  magic link" button. On submit, calls `signInWithOtp` with
  `emailRedirectTo` pointing at the callback route. Shows a "Check your
  inbox" success state on any outcome (Supabase doesn't reveal whether the
  email already has an account, and neither should this UI). Shows a
  generic error state if the Supabase call itself fails (network/rate
  limit on Supabase's side, not something this app controls).
- **`app/hub/auth/callback/route.ts`** — Route Handler. Reads the `code`
  query param Supabase's redirect includes, calls
  `exchangeCodeForSession(code)`. On success: calls
  `claimFitmentLeads(userId, email)` (failure here is logged and
  swallowed — never blocks the redirect), then redirects to
  `/hub/account`. On failure (expired/invalid code): redirects to
  `/hub/login?error=expired` with an inline message on the login page.
- **`lib/claimFitmentLeads.ts`** — `claimFitmentLeads(userId: string,
  email: string): Promise<{ claimedCount: number }>`. Runs the `UPDATE
  fitment_leads SET user_id = $1 WHERE email = $2 AND user_id IS NULL`
  via the admin Supabase client and returns how many rows it touched.
- **`lib/supabaseAuth.ts`** — new module, sibling to the existing
  `lib/supabase.ts`. Exports a cookie-aware, RLS-respecting Supabase
  client factory built on `@supabase/ssr`'s
  `createServerClient`/`createBrowserClient`, used by the login page, the
  callback route (for reading the just-created session/user), the account
  page, and `middleware.ts`. Kept as a separate file from `lib/supabase.ts`
  (the admin client) so the two are never confused at an import site —
  the file you import from tells you which privilege level you're
  getting.
- **`app/hub/account/page.tsx`** — server component. Reads the session via
  `lib/supabaseAuth.ts`, queries the user's claimed `fitment_leads` rows
  (RLS-enforced), renders them as a bare list (role, score, verdict,
  date) with a sign-out button. No styling investment beyond basic
  layout/spacing — this page is replaced wholesale by Phase 2's real
  dashboard.
- **`app/hub/FitmentChecker.tsx`** (modified, not new) — the two existing
  dead "create a free account" / "create a free profile" CTAs become
  `<Link href="/hub/login">`.

## Data Flow

1. Visitor clicks a "create free account" CTA on `/hub`, or navigates to
   `/hub/login` directly.
2. Enters email, submits. `signInWithOtp` fires; UI shows "Check your
   inbox" regardless of whether the account is new or existing.
3. Visitor clicks the magic link in their email, lands on
   `/hub/auth/callback?code=...`.
4. Callback exchanges the code for a session (sets auth cookies via
   `@supabase/ssr`).
5. Callback calls `claimFitmentLeads(userId, email)` using the admin
   client — claims every unclaimed `fitment_leads` row matching that
   email. A failure here is logged, not fatal — the user still gets their
   session.
6. Redirect to `/hub/account`.
7. `/hub/account` reads the session via the cookie-aware client, queries
   the user's own claimed rows (RLS-enforced — cannot read anyone else's),
   renders them.
8. Sign-out clears the session, redirects to `/hub`.
9. `middleware.ts` runs on every request to `/hub/account`: no valid
   session → redirect to `/hub/login`.

## Testing

- `lib/claimFitmentLeads.ts` — unit-tested against a mocked Supabase
  admin client (same mocking pattern as Phase 0's `lib/scoreFitment.ts`
  and `lib/supabase.ts`-consuming tests): confirms the update targets
  only rows matching the given email with `user_id IS NULL`, and that the
  returned `claimedCount` reflects what was actually touched.
- `app/hub/auth/callback/route.ts` — unit-tested with mocked
  `exchangeCodeForSession` and mocked `claimFitmentLeads`: a valid code
  results in the claim function being called with the right
  `(userId, email)` and a redirect to `/hub/account`; an invalid/expired
  code results in a redirect to `/hub/login?error=expired` with the claim
  function never called.
- `app/hub/login/page.tsx` and `middleware.ts` — **no automated tests**,
  matching Phase 0's precedent (this repo has no component/browser test
  infrastructure, and `middleware.ts` is thin glue over Supabase's own SSR
  helper). Verified manually instead: visiting `/hub/account` while
  logged out redirects to `/hub/login`; completing a real magic-link flow
  lands the user on `/hub/account` with a working session.
- One real end-to-end run against a real Supabase project and a real
  email inbox is required before this phase ships — same as Phase 0's
  deferred Task 9. This is the only way to confirm the magic-link email
  actually arrives, the redirect URL is correctly allow-listed in
  Supabase's auth settings, and the claim genuinely fires.

## Explicit open items (not blocking this spec, but not decided)

1. **What exact error copy shows on an expired/invalid magic-link code.**
   Left to the implementation plan — "link expired, request a new one" is
   the intent, exact wording not finalized here.
2. **Whether `/hub/login`'s redirect target after a successful claim
   should differ based on how many rows were claimed** (e.g., a slightly
   different first-login message when 0 vs. 1 vs. several scores were
   found). Not decided — default to always landing on `/hub/account` and
   letting that page's own empty/non-empty state handle the difference.
3. **Supabase magic-link email template/branding** (from-address, subject
   line, template styling) — uses Supabase's default template for this
   phase; customizing it is a follow-on, not blocking.
4. **Rate limiting the magic-link request itself beyond what Supabase
   already enforces** — Supabase's built-in per-email/per-IP throttling on
   `signInWithOtp` is treated as sufficient for this phase; no
   Phase-0-style custom rate limiter is added on top of it here. Revisit
   if abuse is observed.
