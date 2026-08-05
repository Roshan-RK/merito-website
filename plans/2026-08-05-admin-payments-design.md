# Payments/Unlocks Oversight (Slice 4) — Design

**Status:** Approved design, not yet implemented.

## Context

Slice 4 of `plans/2026-08-05-admin-portal-roadmap.md`. PO has no visibility into who paid for what, payment status, or refunds without querying Supabase/Razorpay directly. Adds a standalone payments page under `/admin`.

## Decisions

1. **Read-only, no refund action.** Refunds happen on Razorpay's own dashboard; our webhook (`refund.processed`) only reflects status into `razorpay_transactions.status = 'refunded'` (`lib/razorpay/finalize.ts` `markRazorpayRefunded`). No in-app refund trigger — matches slice 3's read-only convention.
2. **Standalone list page, not folded into candidate drill-down.** `/admin/payments` shows all transactions across all candidates so a PO can spot recent failures/refunds without navigating per-candidate. (Per-candidate payment history is not added to slice 3's page — out of scope here.)
3. **Surface unlocks with no matching payment.** `RAZORPAY_BYPASS` (defaults on unless explicitly `"false"`, see `app/api/hub/unlock-report/route.ts`) grants report/personality/references access without ever creating a `razorpay_transactions` row. If that flag were ever accidentally on in prod, real users would get free access invisibly. The payments page includes a second section listing `report_unlocks`/`product_unlocks` rows with no matching successful transaction — doubles as a canary for this misconfiguration.
4. **Coverage-matching mirrors `finalize.ts` exactly**, not a new inferred rule: a `report_unlocks(user_id, lead_id)` row counts as paid if a successful transaction exists with `product = 'bundle'` OR (`product = 'report'` AND matching `lead_id`). A `product_unlocks(user_id, 'personality' | 'references')` row counts as paid if a successful transaction exists with `product = 'bundle'` OR a matching product. This is the same coverage `finalize.ts` itself applies when granting access, so "unpaid" here means "actually ungranted-by-payment," not a guess.

## Architecture

```
lib/
  adminPayments.ts    # listTransactions(), listUnpaidUnlocks() — service-role, pure aggregation
app/
  admin/
    payments/
      page.tsx         # transactions table + unpaid-unlocks section
```

## Data flow

**`listTransactions()`**:
- All `razorpay_transactions` rows (`order_id, payment_id, user_id, product, level, lead_id, amount_paise, status, created_at`), sorted newest-first.
- Candidate email/name enriched via `fitment_leads`, same dedupe-by-`user_id` approach as slice 3's `listCandidates()`.
- Role title enriched via `lead_id` → `fitment_leads.role_title` for `report`/`bundle` products; `null` for `personality`/`references`/`interview`/`counselling` (not lead-scoped).

**`listUnpaidUnlocks()`**:
- Reads `report_unlocks` (`user_id, lead_id, unlocked_at`, re-keyed since migration 0016) and `product_unlocks` (`user_id, product, unlocked_at`), plus successful `razorpay_transactions` rows.
- Applies the coverage rule from Decision 4 (pure function, unit-tested — same shape as `computeFunnelStage`).
- Returns unlocks with no covering transaction: `{ userId, email, kind: "report" | "personality" | "references", roleTitle: string | null, unlockedAt }`.

## Error handling

- List page, no per-entity `notFound()` case.
- Empty transactions → "No payments yet."
- Empty unpaid-unlocks list → "None — good." (a clean result is the expected/healthy state, not an error).

## Explicitly out of scope

- Refund-triggering action (Decision 1).
- Per-candidate payment history inside slice 3's drill-down page (Decision 2).
- Filtering/search on the transactions table — plain sorted list for v1, matches slice 2/3 convention.
- Editing transaction records — read-only throughout.

## Testing

- `lib/adminPayments.ts`: unit test the unpaid-coverage matching logic (pure function: given transaction rows + unlock rows, return unlocks lacking coverage) — same TDD approach as `computeFunnelStage` in `lib/adminCandidates.ts`.
- Page: manual verification against real data, matching the existing convention for admin pages (slices 2/3 have no page-level tests either).
