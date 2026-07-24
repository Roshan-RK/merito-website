# Privacy & Compliance Fixes — Design

**Date:** 2026-07-24
**Status:** Approved, pending implementation plan

## Background

A review of the Merito HUB candidate flow (prompted by testing the Razorpay
payment integration) surfaced three data-handling gaps:

1. **`app/privacy/page.tsx` makes a false claim.** It states: *"We never
   share your raw fitment score, gaps, or CV content with recruiters or
   third parties without your explicit action."* In reality, every
   fitment-check submission sends the candidate's CV and job description to
   IntervueBox (a third-party AI assessment vendor) as a mandatory,
   non-optional step — that's how the score is generated at all. This is a
   factual inaccuracy in a live legal document, not just a missing
   disclosure.
2. **The referee feedback form has zero consent language.** A referee
   invited via `app/hub/references/feedback/[token]/FeedbackForm.tsx` submits
   their name-linked ratings and free-text feedback with no disclosure of
   who collects it, why, or under what policy. There's no link to the
   privacy policy anywhere on that page.
3. **Deletion requests have no tooling.** The privacy policy tells
   candidates to email `admin@merito.ai` to request deletion, but there is
   no script, endpoint, or process to actually act on that request — a grep
   across the codebase for delete/erasure logic returns nothing.

This spec covers fixing all three.

## Scope decisions (confirmed with stakeholder)

- Deletion tooling is an **admin-run CLI script**, not a self-serve
  dashboard button. Ops runs it manually when a deletion email arrives.
- Payment-related rows (`razorpay_transactions`, `counselling_requests`) are
  **anonymized, not hard-deleted** — the financial/audit trail (amount,
  order id, status, dates) is retained for accounting purposes; only the
  link to the candidate's identity is severed.
- The candidate's CV/resume data on IntervueBox's servers **is in scope**
  for deletion — the tool will attempt to call an IntervueBox delete
  endpoint. This is currently unverified to exist; see "Open dependency"
  below.
- Deletion means **full account closure**: the Supabase auth user is
  deleted too, not just the candidate's data rows. A returning candidate
  signs up fresh.

## A. Privacy policy fix

Rewrite the "What we share" section of `app/privacy/page.tsx` to accurately
state:

- CV content and job description text are shared with IntervueBox (named),
  our AI assessment/interview partner, as a required step to generate the
  fitment score and, if applicable, run the AI mock interview.
- Payments are processed directly by Razorpay (named); Merito never
  receives or stores card details.
- The existing true claim stands: we do not share fitment scores, gaps, or
  CV content with *recruiters* or other third parties without the
  candidate's explicit action (e.g. publishing their HUB profile).

Also update the "Data retention and deletion" section to describe the real
mechanism now backing it: on request, we delete the candidate's assessment
data and close their account; payment records are retained in anonymized
form as required for accounting.

This is copy-only — no code logic changes, no new components.

## B. Referee consent notice

Add a short consent block to the feedback page (either in
`FeedbackForm.tsx` directly or its `page.tsx` wrapper, whichever keeps the
component focused) shown before the rating form:

> "Merito collects this feedback — including your name, email, and ratings
> — to help evaluate the candidate who invited you. See our [Privacy
> Policy](/privacy) for details on how this information is used and
> retained."

No functional change to the submit flow — this is a disclosure added above
the existing form.

## C. Admin deletion CLI: `scripts/admin/delete-candidate.mjs`

Invoked as `node scripts/admin/delete-candidate.mjs <email> [--dry-run]`,
using the Supabase service-role key (same pattern as other admin scripts
already used ad hoc this session). `--dry-run` prints the full plan without
touching any data — given how destructive and hard to undo this operation
is, dry-run is not optional to build.

### Sequence

Order matters: several tables reference `fitment_leads.id` with no
`ON DELETE CASCADE`, so children must be cleared first, and
`razorpay_transactions`/`counselling_requests` must be anonymized *before*
`fitment_leads` is deleted (their `lead_id` FK would otherwise dangle).

1. Look up the auth user by email via the admin API. Abort with a clear
   error if not found — no partial action.
2. Query and hold onto `ib_job_id` / `ib_resume_id` / `ib_applied_job_id`
   from `fitment_leads` and `fitment_interviews` for this user — needed for
   step 8, before the rows that hold them are deleted.
3. Anonymize `razorpay_transactions`: set `user_id` and `lead_id` to
   `NULL`; leave `amount_paise`, `order_id`, `product`, `level`, `status`,
   `created_at`/`consumed_at` untouched.
4. Anonymize `counselling_requests`: set `user_id` to `NULL`.
5. Delete `reference_tokens` → `referees` → `reference_checks`, in that
   order (children before parents).
6. Delete `report_unlocks`, `fitment_interviews`, `fitment_reports`,
   `personality_tests` for this user.
7. Delete `fitment_leads` rows for this user.
8. Best-effort: call the IntervueBox delete/withdraw endpoint for each
   gathered id from step 2. Failures (including "no such endpoint") are
   logged as `MANUAL FOLLOW-UP NEEDED: <detail>` and do **not** stop the
   script — our own data deletion should not depend on vendor API
   availability.
9. `supabase.auth.admin.deleteUser(userId)` — closes the account.
10. Print a summary: what was deleted, what was anonymized, and any
    manual-follow-up warnings from step 8. This is the audit trail for the
    person running the tool.

### Error handling

- Steps run sequentially and are **not** wrapped in a single atomic
  transaction — the Supabase JS client can't easily span a multi-table
  transaction without a dedicated Postgres RPC function, and building one
  is unwarranted for a rare, manually-run ops tool (YAGNI). If a step fails,
  the script stops immediately and prints exactly which step failed and
  what has already been done, so ops can inspect state before deciding how
  to proceed.
- The IntervueBox call in step 8 is explicitly non-fatal, as above.
- If `deleteUser` in step 9 fails after all data steps succeeded, the
  script prints a distinct state: `DATA DELETED, AUTH USER STILL EXISTS —
  retry auth deletion manually` — this is a meaningfully different failure
  mode from an early abort and should read differently to the operator.

### Testing

This script does real, destructive I/O against Supabase and a third-party
vendor API — it cannot be meaningfully unit-tested against production.

- Unit test the pure parts: the ordering/sequencing logic and the
  anonymization payload shapes, with the Supabase client mocked.
- Real validation: `--dry-run` first, then a real run against the
  disposable test candidate already created this session
  (`roshanrk.ai@gmail.com`, which has a real `fitment_leads` row and a real
  completed Razorpay payment from earlier testing) — this doubles as live
  end-to-end verification and cleans up test data we no longer need.

## Open dependency

Whether IntervueBox exposes a delete/withdraw-applicant endpoint is
**unconfirmed** — nothing in `lib/intervuebox/*` or
`specs/2026-07-17-intervuebox-integration-design.md` mentions one. Before
step 8 can be implemented for real, this needs to be confirmed with
IntervueBox (docs or vendor contact). If no such endpoint exists, step 8
becomes a permanent `MANUAL FOLLOW-UP NEEDED` log line, and vendor-side
erasure has to be pursued as a separate, contractual conversation (data
processing agreement terms).

## Out of scope

- Self-serve candidate-facing deletion UI (explicitly deferred; admin tool
  only, per stakeholder decision).
- GDPR-specific handling beyond what DPDP (India) already requires — only
  relevant if EU/UK candidates are confirmed to use HUB, which is unverified.
- Auditing whether a legal Data Processing Agreement exists with
  IntervueBox or Razorpay — that's a legal/contracts matter, not a code
  change.
