# Admin Backend Hardening — Design

**Status:** Approved design, not yet planned/implemented.

## Context

Fifth and final sub-project from the 2026-08-12 admin portal audit (prior: A shell, B1 list UX, B2 drill-down navigation, B3 audit trail — `plans/2026-08-12-admin-*-design.md`). Unlike A/B, this isn't a UX design pass — it's a set of concrete correctness/robustness bugs found in the backend/security review, none involving a real design choice beyond "how do we fix it correctly." Grouped into one spec because every item is small and independent; none needs the multi-question brainstorm treatment.

## Items and fixes

1. **Counselling status-change TOCTOU race** (`lib/adminCounselling.ts`, `app/api/admin/counselling/[id]/route.ts`). Read-then-write with no guard — two admins racing produces a lost update. Fix: add `.eq("status", current.status)` to the `.update()` filter; if the returned row count is 0, return `409` ("Status changed since you loaded this page — refresh and try again.") instead of silently succeeding on stale state.

2. **Interview generate — no idempotency, no remote-status check** (`app/api/admin/interviews/[id]/generate/route.ts`). Fix: before calling `generateInterviewReport`, (a) short-circuit with `409` if `report_generation_requested_at` is already set, and (b) call the existing `getInterviewCandidateStatus` helper (already used by the self-heal poller at `app/api/hub/interview/status/route.ts`) and require `TERMINATED` before firing, returning `409` otherwise. This brings the admin route to parity with the self-heal path's existing guards instead of skipping them.

3. **Interview generate — flag-write-after-external-call ordering.** If the `report_generation_requested_at` update fails after the external `generateInterviewReport` call already succeeded, the self-heal poller can re-fire on its next tick since it never sees the flag. Fix #2 above (checking the flag before firing) bounds this — a retry only duplicates the external call until the flag write eventually lands, not indefinitely. Wrap the flag-write in its own `try/catch` and `console.error` on failure (loud, not swallowed) rather than building transactional guarantees across an external HTTP call, which is disproportionate for this tool's scale.

4. **`RAZORPAY_BYPASS` interview-start has zero tracking** (`app/api/hub/start-ai-interview/route.ts:82-105`). Verified against the actual schema (not assumed): `razorpay_transactions.product` already has an `'interview'` enum value and an `amount_paise` column — no migration needed. Fix: on the bypass branch (`isRazorpayBypassed() === true`), insert a row (`order_id: 'bypass_' + crypto.randomUUID()`, `product: 'interview'`, `status: 'success'`, `amount_paise: 0`, `consumed_at: now`, plus the same `user_id`/`lead_id`/`level` the route already resolves further down for the IntervueBox call). `lib/adminPayments.ts`'s existing "unlocked without payment" canary section gets a small addition: flag `amount_paise = 0` rows as bypass indicators alongside its current no-`razorpay_transactions`-row detection for report/personality/references, so free interview starts stop being invisible on `/admin/payments`.

5. **Structured API error responses.** `app/api/admin/counselling/[id]/route.ts` and `app/api/admin/share-links/[token]/route.ts` currently let `updateCounsellingStatus`/`setShareLinkRevokedByToken` throw uncaught, producing a raw unhandled 500 with no JSON body. Fix: wrap both calls in `try/catch`, return `Response.json({ error: "..." }, { status: 500 })` on failure — gives sub-project A's `Toast` component (already wired to expect a JSON error body) something real to show instead of a generic network-failure message.

6. **Swallowed IntervueBox errors** (`lib/adminCandidates.ts:171-173`, `.catch(() => null)`). Fix: `.catch((err) => { console.error("getCandidateResumeDetails failed", err); return null; })` — same fallback behavior, but no longer silent.

7. **Zero test coverage**: `lib/adminExtension.ts`, `lib/adminLearnedSkills.ts`, `lib/reportShareTokens.ts`'s admin-only `setShareLinkRevokedByToken` (missing-token case), and the DB-querying functions in `adminCandidates.ts`/`adminPayments.ts` (`listCandidates`, `getCandidateDetail`, `listTransactions`, `listUnpaidUnlocks` — existing tests only cover their pure helper functions, not these). Fix: add `vitest` unit tests following this repo's existing mocked-Supabase-client convention (`lib/__tests__/admin*.test.ts`), covering at minimum: empty-result case, missing/malformed ID, and the specific failure paths named in the original audit.

8. **Missing index** on `counselling_requests(status, requested_at)` — the active-queue list (`status in ('requested','scheduled')`, ordered by `requested_at`) does a full scan today. Fine at current row counts, cheap to fix now. New migration, standard `create index`.

9. **Cookie `SameSite` not explicitly configured** (`lib/supabaseAuthServer.ts`) — currently relies on the browser's `Lax` default, which does already mitigate cross-site CSRF on the PATCH/POST admin routes. Fix: set it explicitly in the cookie options passed to the Supabase SSR client rather than relying on an implicit default, so this doesn't silently change if a dependency upgrade ever alters the default. Low priority, included because it's a one-line change while already in this file's neighborhood.

10. **`notes` field has no length cap** (`app/api/admin/counselling/[id]/route.ts:9`, `z.string().optional()`). Fix: `z.string().max(2000).optional()` — matches the kind of bound every other free-text field in this codebase gets, prevents unbounded text into `counselling_requests.notes`.

## Explicitly out of scope

- Anything already covered by A/B1/B2/B3 (UI-layer error surfacing, pagination, drill-down structure, audit-trail logging itself — this doc only fixes the routes' own correctness, B3 adds their logging).
- New admin roles/permissions, RLS changes (RLS was confirmed correct on every scoped table in the original audit — nothing to change).
- Any change to the `RAZORPAY_BYPASS` mechanism itself (it's a legitimate dev/test escape hatch) — this only makes its interview-path usage visible, doesn't restrict or alter it.

## Testing

Item 7 *is* the testing work for the rest of this doc's scope. Additionally: items 1–3 (counselling race, generate idempotency/status-check) should get new test cases in their existing `route.test.ts` files covering the new guard branches (stale-status conflict → `409`, already-requested → `409`, non-`TERMINATED` remote status → `409`). Item 4 gets a test asserting the bypass branch inserts the expected `razorpay_transactions` row. Items 5, 6, 9, 10 are small enough to verify via existing/updated route tests without dedicated new test files.
