# Mock AI Interview — Consumable Pay-Per-Attempt Credit

## Context

This is Phase 3 of `specs/2026-07-23-hub-payu-integration-design.md` ("Interview
— consumable pay-per-use credit"), deferred when the payment rail moved from
PayU to Razorpay (`specs/2026-07-23-hub-razorpay-integration-design.md`) and
never picked back up — `lib/razorpay/finalize.ts` still explicitly rejects the
`interview` product (`"interview" is not wired up yet — a later plan`).

Today, `app/api/hub/start-ai-interview/route.ts` has no payment check at all
(first attempt is free) and structurally blocks every retake: `fitment_interviews`
has primary key `(user_id, role_title)`, so a second attempt for the same role
can't be inserted — the route just returns the existing row's status instead of
starting a new interview.

User confirmed: every attempt should require payment, including the first, and
past attempts should be preserved (not overwritten) when someone retakes.

## Decisions

- **Every interview attempt is a single-use credit**, matching the original
  spec's model for this product: a successful `razorpay_transactions` row with
  `product = 'interview'` is marked `consumed_at` when spent. No
  `product_unlocks` row is ever written for this product (it's consumable, not
  a permanent unlock — same as `counselling`).
- **Credits are fungible, not role-specific.** Matches how `personality` and
  `references` purchases already work (account-level, not tied to a specific
  lead/role at purchase time) — `razorpay/initiate` doesn't currently collect
  a role for those products, and interview follows the same pattern rather
  than introducing a new "pick a role before paying" step.
- **`RAZORPAY_BYPASS` (default on) skips the payment check, not the retake
  fix.** Per the original spec: bypassed consumable products "skip the
  credit-consumption check entirely and always proceed... until pricing/tiering
  is proven out." The schema change that allows multiple attempt rows applies
  regardless of the bypass flag — only the "must have a paid credit" check is
  skippable.
- **History is preserved, not surfaced.** `fitment_interviews` keeps one row
  per attempt. Dashboard and the interview report page continue to show only
  the latest attempt (already how the report page queries — `order by
  updated_at desc limit 1`). No new "past attempts" browsing UI is built in
  this phase.
- **A new attempt is blocked only while a prior one is still `invited`**
  (in progress) for that same role — prevents two concurrent interviews for
  one role. A `ready` (completed) attempt no longer blocks a new one.

## Data model

`fitment_interviews` currently:
```sql
create table fitment_interviews (
  user_id uuid not null references auth.users(id),
  role_title text not null,
  ib_job_id text not null,
  ib_agent_id text not null,
  ib_candidate_id text not null,
  status text not null default 'invited' check (status in ('invited', 'ready')),
  report_raw jsonb,
  invited_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role_title)
);
```

Migration: add a surrogate `id uuid primary key default gen_random_uuid()`,
drop the `(user_id, role_title)` primary key, add a plain (non-unique) index
on `(user_id, role_title)` for the existing "look up this role's interview"
queries.

`razorpay_transactions` and the `product_type` enum already support
`'interview'` and already have a `consumed_at` column
(`supabase/migrations/0012_razorpay_infra.sql`) — no schema change needed
there.

## Payment flow

1. **`app/api/hub/razorpay/initiate/route.ts`** — add `"interview"` to
   `INITIATABLE_PRODUCTS`. Pricing (`PRODUCT_PRICING.interview`) and labels
   (`PRODUCT_LABELS.interview`) already exist in `lib/razorpay/pricing.ts`.
   Uses the existing "most recent lead's candidate_level" pattern, same as
   personality/references — no change needed to that logic.
2. **`lib/razorpay/finalize.ts`** — remove the early
   `if (product === "interview") return { ok: false, reason: "unsupported_product" }`
   guard. With that removed, `interview` falls through the existing
   `if/else if` chain (matching none of the branches) straight to the final
   `update({ status: "success", ... })` — no new per-product branch needed,
   since "becoming spendable" is the entire effect of a successful interview
   payment; actual consumption happens later, in `start-ai-interview`.
3. **New `InterviewPaywallModal.tsx`** (shape mirrors
   `CounsellingPaywallModal.tsx`) — shows the price for the user's level, runs
   Razorpay checkout via the generic initiate/verify routes, then on success
   calls `start-ai-interview` to actually start the attempt.
4. **`app/api/hub/start-ai-interview/route.ts`** — replace the current
   "existing row? return its status" early exit with:
   - If an `invited` (not yet `ready`) row already exists for this
     `(user_id, role_title)`, return its status (unchanged behavior — don't
     start a second concurrent interview).
   - Else, if `RAZORPAY_BYPASS` is on, proceed directly (today's free
     behavior, but now inserting a new row instead of being blocked forever).
   - Else, look up the oldest unconsumed successful `interview` transaction
     (`razorpay_transactions` where `product = 'interview' and status =
     'success' and consumed_at is null`, oldest `created_at` first). None
     found → reject with a clear "payment required" error. Found → mark it
     `consumed_at = now()`, then proceed exactly as today (create job/agent,
     send invite), always inserting a **new** `fitment_interviews` row.

## Fixing a bug this change exposes

`app/api/webhooks/intervuebox/route.ts`'s sweep currently updates rows by
`.eq("user_id", row.user_id).eq("role_title", row.role_title)`. With multiple
attempt rows per role, this would overwrite every past attempt for that role
with the latest report. Fix: select `id` in the sweep query too, and filter
the update by `.eq("id", row.id)` instead.

## UI

In `ProgressRail`, the interview step currently links straight to the report
when `status === "ready"`. Add a small "Retake" text-link next to that row
(a separate click target from "view report") that opens
`InterviewPaywallModal`. The same modal/trigger also replaces today's free
"Start" flow for a first-time attempt, since every attempt now costs money.

## Testing

- `start-ai-interview`: bypass-on free-retake path, bypass-off
  credit-required/consumed path, invited-blocks-second-attempt path, no
  fitment_leads-found path (existing, unchanged).
- `finalize.ts`: interview product now reaches the generic success-marking
  path instead of returning `unsupported_product`.
- Webhook sweep: two attempt rows for the same role, only the targeted `id`
  gets updated, not both.

## Out of scope

- No "past attempts" history/browsing UI.
- No role-specific credit purchase (credits stay fungible, oldest-first).
- No changes to counselling's request-only (no booking UI) model.
