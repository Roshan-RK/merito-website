# Razorpay Payment Lifecycle — Failure Tracking, Refunds, Ops Alerts

## Context

The initial Razorpay build only handles the success path: `payment.captured`
webhook unlocks the report. A failed payment silently leaves its
`razorpay_transactions` row stuck at `status='initiated'` forever, and a
refund issued from the Razorpay dashboard has no effect on our side at all —
the candidate keeps access to a report they were refunded for.

## Decisions

- **Candidate-facing emails are dropped.** Razorpay's own checkout already
  sends the payer a receipt/failure email automatically — a second,
  Merito-branded one would be redundant and confusing (candidate gets two
  emails for one event). Only an internal ops alert is built, since nothing
  else provides that.
- **Failure tracking**: webhook route gets a `payment.failed` branch,
  mirroring the existing `payment.captured` one. Looks up the transaction,
  marks it `failed` only if still `initiated` (idempotent — a duplicate
  webhook delivery for the same failure is a no-op), then sends one ops
  alert email to `CONTACT_TO_EMAIL`.
- **Refunds**: webhook route gets a `refund.processed` branch. Verified
  against Razorpay's webhook payload docs (`docs/webhooks/refunds/`): the
  event's top-level `contains` is `["refund", "payment"]`, and — same as
  `payment.captured`/`payment.failed` — the original `order_id` is under
  `payload.payment.entity.order_id`, *not* under `payload.refund.entity`
  (which only carries the refund's own `id`, e.g. `rfnd_...`, no order
  reference). Looks up the transaction by that `order_id`; if it was
  `success`, deletes the matching `report_unlocks` row (revoking access)
  and marks the transaction `refunded`. Idempotent — re-processing an
  already-`refunded` transaction is a no-op.
- **Migration**: `razorpay_transactions.status` check constraint extends
  from `('initiated','success','failed')` to add `'refunded'`.
- **Email pattern**: `lib/paymentEmails.ts` mirrors `lib/referenceEmails.ts`
  exactly — same `getResendClient()`/`getFromEmail()` shape, same
  `resend.emails.send()` call style. `sendPaymentFailedAlertEmail(details)`
  sends to `CONTACT_TO_EMAIL` (unchanged existing env var, already used by
  `app/api/contact/route.ts`).

## Out of scope

- No self-serve refund trigger (refunds stay dashboard-initiated).
- No candidate-facing emails (Razorpay's own cover that).
- No `payment.failed`/`refund.processed` handling for products other than
  `report` — same `product !== "report" → unsupported`-style gate as the
  existing success path, since only report is live this phase.
