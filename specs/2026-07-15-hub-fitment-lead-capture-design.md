# Merito HUB — Phase 0: Anonymous Fitment Check & Lead Capture

## Context

Merito HUB is a new candidate-facing product being layered onto the existing
static Next.js marketing site (`merito-website-v2`). The full product vision
spans several dependent subsystems: anonymous lead capture, accounts, a real
fitment-scoring engine, a personality test, paid mock AI interviews and
reference checks, payments, and a configurable shareable PDF export.

That's too large for one spec. It's being decomposed into phases, each with
its own design → plan → build cycle:

- **Phase 0 (this doc)** — anonymous fitment check + lead capture on `/hub`.
- **Phase 1** — accounts (signup/login).
- **Phase 2** — real fitment report (detailed) + free personality test, both
  live in an authenticated dashboard.
- **Phase 3** — payments (Razorpay) for re-checks, mock AI interview (calls a
  third-party interview-AI vendor), and reference checks.
- **Phase 4** — shareable PDF export with user-selectable sections.

Today, `merito-website-v2` has **no backend beyond a Resend-powered contact
form** (`app/api/contact/route.ts`). No database, no auth, no AI integration,
no file storage. The `/hub` landing page's fitment-checker UI
(`app/hub/FitmentChecker.tsx`) currently fakes its score client-side with a
seeded pseudo-random number — no network call exists.

A separate Merito product, RAMP, advertises "AI Resume Parsing" / "AI match
scoring" in its own marketing copy (`app/ramp/page.tsx`), but this is **not**
reachable from this repo — confirmed by search: no API keys, no endpoint
references, no shared code. RAMP is a fully separate product/team. If its
scoring engine becomes available later, Phase 0's scoring is built as a
swappable interface specifically so it can be substituted in without touching
UI or API-route code.

## Decisions carried into this phase

- **Deployment**: same Next.js app, same Vercel deployment. No subdomain, no
  separate service. (`app.merito.ai` is already used by an unrelated Merito
  project, so HUB's dashboard — if it ever gets a subdomain — would need a
  different one; not needed for Phase 0.)
- **Database**: Supabase (Postgres). Chosen over Railway/Neon because it also
  bundles auth, which Phase 1 needs next — one fewer integration to add later.
- **Scoring LLM**: Claude (Anthropic API), called behind a swappable interface.
- **CV storage**: **none.** The uploaded CV is parsed to text in memory,
  sent to the scoring call, and discarded. It is never written to disk,
  object storage, or the database — not even as extracted text.
- **Lead-sheet mirror (Google Sheets)**: explicitly **out of scope** for
  Phase 0. The database is sufficient for the "score reappears after
  signup" requirement; Sheets sync is a nice-to-have for the sales-followup
  workflow, deferred to a later pass.
- **Rate limiting**: the exact quota (checks per email per day, etc.) is
  **not decided yet** — flagged as an explicit open item below. The
  plumbing (a rate-limit check called before the scoring call runs) is
  built now with a placeholder limit so it isn't wide open at launch.

## What Phase 0 actually produces

Phase 0 answers one question for an anonymous visitor: *"how well does my CV
fit this job?"* — and captures them as a lead in the process. It does **not**
produce the detailed report (strengths/gaps breakdown); that's an
account-gated feature built in Phase 2, and requires the CV to be uploaded
again at that point, since Phase 0 never keeps it.

## Architecture

- New route: `POST /api/hub/fitment-check` in the existing Next.js app —
  no new service, no new deployment.
- New Supabase table `fitment_leads`:
  - `id` (uuid, pk)
  - `email` (text, not null) — the join key used in Phase 1 to reattach
    this score to a newly created account.
  - `role_title` (text, not null) — free-text role name the user typed.
  - `jd_text` (text, not null) — the JD content, whether pasted directly
    or fetched from a link (see "JD link mode" below).
  - `jd_source` (enum: `paste` | `link`)
  - `score` (numeric)
  - `verdict` (text) — the one-line summary Claude returns alongside the
    score.
  - `created_at` (timestamptz, default now())
  - No CV column of any kind.
- Scoring interface:
  ```ts
  type FitmentResult = { score: number; verdict: string };
  type ScoreFitment = (jdText: string, cvText: string) => Promise<FitmentResult>;
  ```
  Default implementation calls the Claude API with the JD text and the
  extracted CV text, requesting a structured JSON result (score 0–10 +
  one-line verdict). Implementation lives behind this single function so a
  different provider (e.g., a future RAMP-provided engine) can be swapped
  in without changing the route handler or the UI.
- CV parsing: `pdf-parse` for PDF, `mammoth` for DOCX, run inside the API
  route handler, in memory. The extracted text is passed straight into
  `scoreFitment` and never persisted.
- Abuse gating: reCAPTCHA (already configured via `RECAPTCHA_*` env vars for
  the existing contact form) is required on submit, checked before any
  parsing or scoring work happens. A rate-limit check (by email, exact
  threshold TBD) also runs before the scoring call — this exists specifically
  so a single anonymous visitor can't run up unbounded Claude API cost.

## Data flow

1. User on `/hub` fills in: target role, a JD (pasted text or a link —
   see below), uploads a CV file, and enters their **email** (new field —
   does not exist in the current UI).
2. Email is **required before the check can run**, not after. Every check
   costs a real AI call, so the form should never be able to trigger that
   spend without capturing a lead. Submit button stays disabled until an
   email is present, matching the pattern the rest of the site already uses
   for CTA gating.
3. Client submits `POST /api/hub/fitment-check` with `{ email, role,
   jdText | jdUrl, cvFile }`.
4. Server: verify reCAPTCHA token → check rate limit for this email → parse
   CV file to text in memory → call `scoreFitment(jd, cvText)` → discard
   CV text.
5. Server inserts one row into `fitment_leads` (email, role, jd_text,
   jd_source, score, verdict).
6. Server responds with `{ score, verdict }`. The existing count-up
   animation in `FitmentChecker.tsx` now animates a real number instead of
   the current fake hash-derived one.
7. **(Phase 1, not built in this phase)** — when a visitor later signs up
   with the same email, the signup flow will look up matching
   `fitment_leads` rows and surface the most recent one in the new
   account's dashboard as "Step 1 already complete," instead of a blank
   state.

## Components (UI changes to `app/hub/FitmentChecker.tsx`)

- **Email field** — new, required, positioned above the submit button.
- **JD input** — replaces the current single ambiguous "paste JD or link
  here" field with two explicit modes, matching the "Paste JD / JD link"
  segmented toggle already designed in the dashboard prototype's re-check
  modal (same interaction pattern, reused for consistency): a textarea for
  pasted JD text, or a URL input for a JD link. If a link is supplied, the
  server is responsible for fetching/using it as the JD source for scoring
  (fetch-and-extract behavior is an implementation detail for the build
  plan, not fully specified here).
- **CV upload** — replaces the current "tap to simulate" toggle with a real
  file input, restricted to PDF/DOCX, with a client-side size cap (e.g. 5MB)
  checked before upload.
- **Submit** — replaces the local `setTimeout` + seeded-hash fake scoring
  with a real network call to `/api/hub/fitment-check`. The existing
  "Scoring your CV…" loading state is kept, now driven by the real request
  instead of a fixed timer.
- **Error states** (new — none of these exist today):
  - reCAPTCHA failed → "We couldn't verify you're human — please try again."
  - Rate-limited → "You've checked your fitment recently — try again later."
    (exact wording/threshold pending the rate-limit decision)
  - CV couldn't be parsed → "We couldn't read that file — please upload a
    PDF or DOCX."
  - Generic failure → "Something went wrong — please try again."
  All shown as friendly inline text under the form, not raw error output.

## Testing

- `scoreFitment` is unit-tested against a mock/fake provider — tests never
  call the real Claude API, keeping them free and fast.
- API route tests: valid submission creates exactly one `fitment_leads` row
  with the expected fields; missing email is rejected; unsupported file type
  is rejected; failed reCAPTCHA is rejected before any parsing/scoring work
  runs.
- One manual end-to-end run against the real Claude API key, to confirm the
  full path (form → API → Claude → Supabase → UI) before shipping.

## Explicit open items (not blocking this spec, but not decided)

1. **Rate-limit threshold** — exact number of checks allowed per email per
   time window. Plumbing exists; number TBD before launch.
2. **Multiple pre-signup checks** — if a visitor runs several checks (e.g.
   different roles) before signing up, Phase 1's "reattach to dashboard"
   step currently plans to surface *all* of them rather than just the
   latest. Not re-litigated here; noted for Phase 1's own spec.
3. **JD-link fetching behavior** — when a visitor supplies a JD link
   instead of pasted text, the exact fetch/extraction approach (timeout,
   failure handling, disallowed domains, etc.) is left to the
   implementation plan, not specified here.
4. **Google Sheets lead mirror** — deferred out of Phase 0 entirely, may be
   picked up as a small follow-on once Phase 0 ships.
