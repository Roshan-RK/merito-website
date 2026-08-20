# Admin Billing / Transaction Management — Design

**Status:** Approved design, not yet planned/implemented.

## Context

Fifth of the 13-category admin survey. No subscriptions exist — Merito Hub is pure one-off product purchases (`report`, `personality`, `references`, `interview`, `bundle`, `counselling`) via Razorpay, hardcoded pricing (`lib/razorpay/pricing.ts`, no discount/coupon mechanism anywhere). `plans/2026-08-05-admin-payments-design.md` deliberately deferred both search/filter and any in-app refund trigger ("refunds happen on Razorpay's own dashboard"). This spec builds the in-app refund trigger, plus comp-access and stuck-transaction correction — closes item F's sibling gap (`plans/2026-08-13-admin-override-recovery-design.md` deferred refund to here).

**Critical finding that reshapes this spec's core:** the existing `markRazorpayRefunded()` (`lib/razorpay/finalize.ts:101-123`, currently only invoked reactively by the Razorpay refund webhook) is hardcoded report-product-only:

```ts
if (txn.status !== "success" || txn.product !== "report" || !txn.lead_id) {
  return { ok: true, alreadyProcessed: true };
}
```

For `personality`/`references`/`interview`/`bundle`/`counselling` this silently no-ops — status never flips to `refunded`. Concretely, for `interview`, the credit-check in `start-ai-interview/route.ts` is `status='success' AND consumed_at IS NULL` — since refunding never flips `status` away from `success` today, **a candidate refunded before using their interview credit can still start it for free**. This is a real bug, not just a missing feature, and it's inside the same code path this spec needs to touch anyway.

## Items

### 1. Generalize the refund status-flip (fixes the interview double-dip)

Remove the `product !== "report"` guard from `markRazorpayRefunded()` — flip `status: 'refunded'` for any product. This alone closes the interview double-dip, since `start-ai-interview` already filters on `status='success'`.

### 2. Per-product access revocation on refund

Status-flip isn't enough for products whose access isn't gated by the transaction row itself:

| Product | Access gated by | Revocation needed |
|---|---|---|
| `report` | `report_unlocks` row | Already handled (existing report-only path) |
| `interview` | `razorpay_transactions.status='success'` directly | Covered by item 1 alone — no separate table |
| `personality`, `references` | `lib/productUnlocks.ts` unlock row | **New**: `productUnlocks.ts` has no revoke function at all today — add `revokeProduct(userId, leadId, product)` |
| `bundle` | grants report + personality + references together | Revoke all three underlying grants tied to the same `order_id` |
| `counselling` | `counselling_requests` row | Reuse existing `updateCounsellingStatus(id, 'cancelled')` — the state machine already allows this transition, nothing new needed |

`markRazorpayRefunded()` becomes a dispatcher: flip status (always), then call the matching revocation for the product (no-op for `interview`, existing logic for `report`, new `revokeProduct` for `personality`/`references`, loop over the three for `bundle`, `updateCounsellingStatus` for `counselling`).

### 3. Outbound refund call (new integration — none exists today)

Only inbound (`app/api/webhooks/razorpay/route.ts` reacting to Razorpay's own dashboard-issued refunds) exists. New: `lib/razorpay/client.ts::createRefund(paymentId, amountPaise)` calling Razorpay's `POST /v1/payments/{id}/refund`. Admin action `POST /api/admin/payments/[orderId]/refund` calls this, then calls the now-generalized `markRazorpayRefunded()` directly (don't wait for the webhook round-trip — apply the same revocation immediately, webhook becomes a redundant confirmation if it later arrives, already idempotent via the existing `alreadyProcessed` check).

### 4. Grant free/comp access

New `grantFreeAccess(userId, leadId, product, level, reason)`: inserts a marker `razorpay_transactions` row (`order_id: 'comp_' + uuid`, `status: 'success'`, `amount_paise: 0`, `consumed_at`: set for immediately-consumed products, null for `interview` credit) — same shape as the `RAZORPAY_BYPASS` tracking insert already speced in the backend-hardening doc, but admin-triggered per-candidate instead of a global dev env flag. Then calls the **same completion function the real payment flow calls** for that product (`completeReportUnlock()` for `report`, `unlockProduct()` for `personality`/`references`, nothing further for `interview` since the `$0` success row *is* the credit, direct `counselling_requests` insert for `counselling`) — reuses real pipeline code rather than hand-writing the unlock state, consistent with how #2's rejected raw-CRUD and #3's force-actions were scoped. `admin_audit_log` records product/level/reason.

### 5. Void a stuck transaction

For rows stuck at `status='initiated'` (payment session abandoned, never completed) — no new enum value needed, `'failed'` already exists (`0013` widened the enum). `voidStuckTransaction(orderId)` — guarded transition, `initiated → failed` only (reject if already `success`/`refunded`/`failed`), matching the existing `ALLOWED_TRANSITIONS` state-machine pattern from `adminCounselling.ts`. This is a data-correction action, not a refund — for a genuine duplicate **successful** charge, the second transaction still needs a real refund (item 3), voiding alone doesn't move money back.

## API routes

- `POST /api/admin/payments/[orderId]/refund` `{ reason }`
- `POST /api/admin/payments/grant` `{ userId, leadId, product, level, reason }`
- `POST /api/admin/payments/[orderId]/void`

All: `requireAdmin()`, Zod-validated, `try/catch` → structured error, `admin_audit_log` write.

## UI

- `/admin/payments` transaction rows get contextual actions: `initiated` rows → "Void"; `success` rows → "Refund"; new "Grant free access" button opens a small form (candidate search, product, level, reason) above the table, not per-row since it's not tied to an existing transaction.
- Refund and Void both go through `ConfirmDialog`; refund's dialog additionally shows the exact amount being refunded (pulled from the transaction row, not re-entered — no room for admin typo on a real-money action, unlike #3's reconciliation form which needs entry because no source-of-truth amount exists yet there).

## Error handling

- Refund on an already-refunded/already-failed transaction: `409`.
- `revokeProduct` for `personality`/`references` on a product that was never actually unlocked (e.g. refunding a `failed` transaction by mistake): no-op, not an error — matches `markRazorpayRefunded`'s existing `alreadyProcessed` idiom.
- Grant on a product the candidate already has unlocked: `409` ("already unlocked, no action taken") rather than silently double-granting.

## Testing

- `markRazorpayRefunded()`: table-driven test across all 6 products confirming the correct revocation fires for each (this is the regression test for the interview double-dip bug specifically — assert `status` flips AND, separately, that a post-refund `start-ai-interview` call is rejected).
- `createRefund()`: mocked Razorpay client, assert correct endpoint/payload.
- `grantFreeAccess()`: one test per product confirming it calls the real completion function (not a hand-rolled unlock), plus the `$0`/marker-row shape.
- `voidStuckTransaction()`: transition-guard tests (`initiated→failed` allowed, `success→failed` rejected).
- Route tests: standard 401/400/409/happy-path per new endpoint.

## Explicitly out of scope

- Coupon/discount/promo-code system — no existing partial mechanism, would be a separate feature entirely, no evidence it's needed yet.
- Partial refunds — confirmed no partial-amount concept anywhere in the schema or code; full-amount only.
- Duplicate-payment *prevention* (idempotency guard on the initiate route) — a real latent gap found during this investigation, but it's a candidate-facing correctness fix, not an admin capability; belongs in a future backend-hardening-style spec, not here. This spec's Void action handles the *cleanup* side, not prevention.
- Payment search/filter — already deliberately deferred in the original payments design doc; B1 (list UX, unbuilt) is the natural home when it happens.
