# Merito HUB — PayU Payment Infra (Tiered, Bundle, Bypass-First)

## Context

Today, only the detailed fitment report has a paywall (`ReportPaywallModal` →
`POST /api/hub/unlock-report`), and it's a fake unlock — clicking "pay"
instantly unlocks with no charge, tracked in `report_unlocks`
(keyed by `user_id, role_title`). The personality test, mock AI interview,
and reference checks are all fully free to start today. There is no 1:1
counselling product anywhere in the codebase.

The user supplied a real price table (tiered by candidate level — entry/mid/
senior — with a discounted bundle) and a set of business rules that differ
significantly from the initial flat-₹299-everywhere assumption. This spec
supersedes the first draft of this document, written before the pricing
table and business rules were available.

The reference design file
(`design_handoff_merito_hub/dashboard/Merito HUB Dashboard.dc.html`,
outside this repo, referenced by `specs/2026-07-16-hub-dashboard-report-design.md`)
is the source for paywall copy/UX (title, sample preview rows, CTA text,
toast messages) — reused directly rather than reinvented, except where its
flat pricing and "interview: pay once, unlimited retakes" claim are
explicitly overridden below by newer business rules.

## Pricing model

| Product | Entry | Mid | Senior | Unlock granularity |
|---|---|---|---|---|
| Report (bundle & solo, same price) | ₹299 | ₹299 | ₹299 | Per `fitment_leads` row (per JD/CV submission) |
| Personality — bundle rate | ₹299 | ₹499 | ₹999 | One-time per account |
| Personality — solo rate | ₹349 | ₹999 | ₹1499 | One-time per account |
| Reference check (bundle & solo, same price) | ₹299 | ₹499 | ₹499 | One-time per account |
| Mock AI interview | ₹999 | ₹999 | ₹1499 | Consumable — pay per attempt |
| 1:1 counselling | ₹1999 | ₹1999 | ₹2999 | Consumable — pay per request |

- **Bundle** = Report + Personality (bundle rate) + Reference, paid as one
  PayU transaction. Only Personality actually changes price when bundled —
  Report and Reference are the same number either way. Only offered while
  the account doesn't already have Personality and References unlocked
  (bundling only makes sense the first time; a later report-only repurchase
  for a different role is a solo Report purchase, not a bundle).
- **Level source**: candidate self-selects entry/mid/senior on the
  fitment-check form (no automatic classification — confirmed neither
  IntervueBox nor any existing code exposes a seniority signal; see Open
  Items). Stored as `candidate_level` on `fitment_leads`, one value per
  lead/submission (a candidate could plausibly apply at different levels
  for different roles over time). All pricing lookups for that lead's
  report/bundle use that lead's `candidate_level`; personality/interview/
  references/counselling purchases (which aren't tied to a specific lead)
  use the candidate's most recent lead's level.
- **Placeholder note**: these are the real numbers from the user's price
  table, not flat guesses — no further placeholder substitution needed
  before launch (pricing itself may still change; the config is one file,
  `lib/payu/pricing.ts`, regardless).

## Decisions

- **Report re-scopes from per-role to per-lead.** `report_unlocks` moves
  from `(user_id, role_title)` to `(user_id, lead_id)`. Editing the JD or
  CV and resubmitting creates a new `fitment_leads` row via the existing
  `rescore-role` → `fitment-check` chain — its detailed report is a fresh
  paywall, even if a prior submission for the same role title was already
  unlocked. This reverses the first draft's "leave report untouched"
  decision — the user explicitly wants this behavior change.
- **Personality and references are account-level, one-time.** Not scoped
  to a specific role — pay once, usable for any role's personality test /
  reference check going forward. References already work this way today
  (`initiateReferenceCheck(user.id)` takes no role); personality moves to
  match.
- **Interview and counselling are consumable, not permanent unlocks.**
  Every mock interview attempt requires its own successful payment — this
  explicitly overrides the reference design file's "pay once, unlimited
  free retakes" copy, per the user's direct instruction. Modeled as: each
  successful `payu_transactions` row for `interview` (or `counselling`) is
  a single-use credit, marked `consumed_at` when spent. No `product_unlocks`
  row is ever written for these two products.
- **Counselling has no booking UI.** Confirmed by the reference design
  file's own copy ("Expert session request sent — we'll confirm your
  slot"). Paying creates a request record; a human follows up manually.
  No calendar/scheduling integration.
- **Flow: PayU Hosted Checkout (redirect), not Seamless/iframe.**
- **Bypass flag: `PAYU_BYPASS`, default ON.** Read as
  `process.env.PAYU_BYPASS !== "false"`. When bypassed: one-time products
  record an unlock instantly with no PayU call; consumable products
  (interview/counselling) skip the credit-consumption check entirely and
  always proceed — matching today's fully-free behavior for both kinds of
  product until pricing/tiering is proven out and the flag is flipped off.
- **Hash verification and the shared finalize function** follow the first
  draft's design unchanged: `lib/payu/client.ts` builds/verifies PayU's
  SHA-512 request/response hashes (standalone functions, mirroring
  `app/api/webhooks/intervuebox/route.ts`'s pattern); `lib/payu/finalize.ts`
  is the one place both the webhook and the browser-return route call to
  verify + apply the payment's effect (record a one-time unlock, or mark a
  consumable credit as available-to-consume).
- **Enforcement is server-side**, not just UI-side, on every gated route.

## Data model

- `fitment_leads` gets a new `candidate_level` column
  (`'entry' | 'mid' | 'senior'`), set from a new required dropdown on the
  fitment-check form.
- `product_unlocks(user_id, product, unlocked_at, payu_txnid)` — one-time
  account-level unlocks, for `personality` and `references` only.
  `product` is `'personality' | 'references'` (not the 5-way union — the
  other three products don't use this table).
- `report_unlocks` is re-keyed from `(user_id, role_title)` to
  `(user_id, lead_id)`.
- `payu_transactions(txnid, user_id, product, level, amount_paise, status,
  consumed_at, created_at)` — `product` here is the full 5-way union
  (`report | personality | references | interview | counselling |
  bundle`). `consumed_at` is null until an `interview`/`counselling`
  credit is spent; unused (always null) for the other product kinds.
- `counselling_requests(id, user_id, payu_txnid, status, requested_at)` —
  created when a counselling payment succeeds; a human-operated follow-up
  process (out of this phase's scope) moves `status` forward.

## Phasing

This is five sub-systems sharing one payment rail, not one project — split
into five plans, each independently shippable and testable, in this order:

1. **Shared infra + report re-scoping** — PayU client/hash, `payu_transactions`,
   bypass flag, generic initiate/webhook/return routes, `candidate_level`
   field on the fitment-check form, re-scope `report_unlocks` to per-lead.
   Everything else depends on this.
2. **Personality + references** — account-level one-time gate using
   `product_unlocks`.
3. **Interview** — consumable pay-per-use credit.
4. **Bundle** — combined report+personality+references checkout.
5. **1:1 counselling** — new request-based product, no booking UI.

## Open Items

- Confirmed via IntervueBox's public API docs (`/api/public/jobs.md`,
  `/api/public/reports.md`, fetched 2026-07-23): no endpoint anywhere
  returns a seniority/level classification. `designation` is an
  outbound-only field we set ourselves. `totalExperience` (candidate's
  actual resume-parsed years) exists on `Get Applicant Details` and could
  power automatic level classification later, but self-select is what's
  being built now.
- Real PayU sandbox merchant key/salt: user has these already, added to
  `.env.local` (gitignored) — not committed anywhere.
