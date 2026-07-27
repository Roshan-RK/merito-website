# Merito HUB — Gateway Swap: PayU → Razorpay

## Context

Plan 1 (`specs/2026-07-23-hub-payu-integration-design.md`) was fully built against PayU
in this same branch/worktree, all 11 tasks done, final-reviewed, one critical
retry-safety bug found and fixed. Nothing was ever merged to `preview` and no
migration was ever applied to any real database (`npx supabase db push` was
deliberately never run) — this is a clean swap, not a migration of live data.

The user has switched the gateway to Razorpay (will supply `key_id`/`key_secret`
directly, not via chat). **Every business rule from the original spec is
unchanged** — bypass-first, tiered pricing, bundle, per-lead report re-lock,
consumable interview credits, 5-phase rollout. Only the payment-gateway
mechanics change. This doc covers only what's different.

## Why Standard Checkout (not Payment Links)

User chose Razorpay's Standard Checkout: server creates an Order, client loads
`checkout.js` and opens an in-page payment modal — no page navigation. This
is a real UX upgrade over PayU's full-page redirect, but it changes the
integration shape: there's no "browser lands back on our server" step in the
happy path. Payment confirmation reaches the server two ways instead:

1. **Client-side, fast, less trusted alone:** after the modal succeeds,
   Razorpay's JS hands the client `razorpay_order_id`, `razorpay_payment_id`,
   `razorpay_signature` — the client POSTs these to a new `verify` endpoint.
2. **Server-to-server, authoritative:** Razorpay also calls a webhook.

Both paths call the same idempotent `finalizeRazorpayOrder(orderId, paymentId)`
— same DRY principle as PayU's `finalizePaymentFromPayu`, same idempotency
guard, same "unlock before marking success" ordering (the bug fixed in the
PayU build applies identically here and is built correctly from the start).

## Verified signature formulas

Fetched directly from Razorpay's official Node SDK source
(`razorpay-node/dist/utils/razorpay-utils.js`), not assumed from memory:

- **Payment verification** (client → server, after checkout modal succeeds):
  `HMAC-SHA256(orderId + "|" + paymentId, key_secret)`, compared to
  `razorpay_signature`.
- **Webhook verification** (Razorpay → server, `X-Razorpay-Signature` header):
  `HMAC-SHA256(raw_request_body, webhook_secret)` — must hash the *raw*
  body, never a parsed/re-serialized one (Razorpay's own docs stress this).

These are two *different* secrets (`RAZORPAY_KEY_SECRET` vs
`RAZORPAY_WEBHOOK_SECRET`) and two different verify functions — unlike PayU,
where one `verifyResponseHash` covered both callers, because PayU's webhook
and browser-return both carried the same signed field set. Razorpay's two
channels carry different payloads, so `lib/razorpay/client.ts` exposes two
distinct verify functions instead of one shared one; the shared part is only
the *apply-the-effect* step, in `finalize.ts`.

## Data model change

`payu_transactions` (never applied to any DB) is replaced outright by
`razorpay_transactions`, keyed by `order_id` (Razorpay's own primary
identifier) instead of a self-generated `txnid`:

```
razorpay_transactions(
  order_id text primary key,   -- Razorpay's order id, e.g. "order_XXXXXXXX"
  payment_id text,              -- filled in once payment succeeds
  user_id uuid not null,
  product product_type not null,
  level candidate_level not null,
  lead_id uuid,
  amount_paise integer not null,
  status text not null default 'initiated' check (status in ('initiated','success','failed')),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
)
```

The enum backing `product` is renamed `payu_product` → `product_type`
(gateway-neutral naming — this table's shape has nothing PayU- or
Razorpay-specific about the enum itself, only about `order_id` being the
gateway's own identifier rather than a self-generated one).

## Route shape change

- `POST /api/hub/unlock-report` — bypass path identical to PayU's. Live path
  now calls `createOrder()` (Razorpay Orders API) instead of building a
  hash-signed redirect form, inserts the pending `razorpay_transactions` row,
  and returns `{status:"checkout", orderId, amountPaise, currency:"INR",
  keyId, name, description, prefill}` — `keyId` is Razorpay's *public* key
  id, safe to hand to the client (unlike `key_secret`, which never leaves
  the server).
- `POST /api/hub/razorpay/verify` (**new**, replaces `app/hub/payu/return`) —
  client posts `{orderId, paymentId, signature}` after the checkout modal's
  `handler` callback fires. Verifies the payment signature, calls
  `finalizeRazorpayOrder`, then (mirroring the old bypass path) fetches and
  saves the resume-match report and returns `{status:"unlocked", report}`.
- `POST /api/webhooks/razorpay` (replaces `app/api/webhooks/payu`) — reads
  the *raw* body, verifies `X-Razorpay-Signature`, parses the JSON payload,
  extracts `order_id`/`payment_id` from `payload.payment.entity`, calls the
  same `finalizeRazorpayOrder`. Always 200s on a *handled* payload — but, per
  the same reasoning the PayU build already settled on, a genuinely thrown
  exception (bad env config, a DB error) is allowed to surface as a 500 so
  Razorpay retries, rather than being swallowed into a false-positive 200.

## UI change

`ReportPaywallModal.tsx`'s hidden-form-auto-submit-and-navigate-away logic is
replaced with: fetch `unlock-report` → on `{status:"checkout"}`, lazily load
`https://checkout.razorpay.com/v1/checkout.js` if not already on the page,
construct `new window.Razorpay({key, amount, currency, order_id, name,
description, prefill, handler, modal:{ondismiss}})`, call `.open()`. The
`handler` callback POSTs to `/api/hub/razorpay/verify` and calls `onUnlocked`
with the returned report. `modal.ondismiss` resets the "paying" state so a
user who closes the modal isn't stuck on a spinner.

## Env vars

`PAYU_MERCHANT_KEY`/`PAYU_MERCHANT_SALT`/`PAYU_BASE_URL`/`PAYU_BYPASS` →
`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`/
`RAZORPAY_BYPASS` (same `!== "false"` bypass-by-default semantics). No new
`NEXT_PUBLIC_*` var needed — `keyId` is handed to the client per-request in
the `unlock-report` JSON response, not baked into the client bundle.

## Out of scope (unchanged from the PayU plan)

Personality/references/interview/counselling/bundle remain deferred to
later plans, now against Razorpay instead of PayU.
