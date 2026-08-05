# Counselling Ops Queue (Slice 5) — Design

**Status:** Approved design, not yet implemented.

## Context

Slice 5 of `plans/2026-08-05-admin-portal-roadmap.md`. `counselling_requests` rows are created by `lib/razorpay/finalize.ts` on successful payment (`status = 'requested'`) and never touched again — no cron, webhook, or UI updates status after that. Every paid counselling request is stuck at `requested` forever unless someone edits Supabase directly. Unlike slices 3/4 (read-only), this slice needs a write path so ops can actually work the queue: schedule sessions and mark them done.

## Decisions

1. **Write capability, not read-only.** Confirmed nothing auto-updates `counselling_requests.status` today (checked `finalize.ts`, webhook handlers, cron-like code — none touch it post-insert). Read-only would just show a permanently-stuck list.
2. **Schema gets ops fields.** Table currently only has `id, user_id, order_id, status, requested_at`. Adding `scheduled_at`, `completed_at`, `notes` (all nullable) — needed to actually run a counselling queue, not just flip an enum.
3. **Transition graph, enforced server-side:**
   - `requested → scheduled` (sets `scheduled_at = now()`)
   - `requested → cancelled`
   - `scheduled → completed` (sets `completed_at = now()`)
   - `scheduled → cancelled`
   - `scheduled → requested` (clears `scheduled_at`, undo/reschedule path)
   - `completed` and `cancelled` are terminal — no further transitions. Mistakes fixed via Supabase directly (rare, matches how slice 4 treats refunds).
4. **Drill-down page for status changes, not inline dropdown.** Click into a request → dedicated page with status dropdown (restricted to valid next-states for current status) + notes textarea + save. Slower per-action than an inline table dropdown, but gives room for notes and matches slice 3's drill-down pattern (`/admin/candidates/[userId]`).
5. **Mutation via API route, not Server Action.** Repo has zero Server Actions anywhere (`grep "use server"` → no matches); all mutations go through `app/api/**/route.ts` handlers called via `fetch` from a client component. Following that existing convention rather than introducing a new one.
6. **List page defaults to active-only.** Shows `requested` + `scheduled` by default (the actual queue to work); `?all=1` toggle reveals `completed`/`cancelled` history too.

## Architecture

```
supabase/migrations/
  0025_counselling_requests_ops_fields.sql   # scheduled_at, completed_at, notes columns

lib/
  adminCounselling.ts
    nextCounsellingState(current, next) -> { status, scheduled_at, completed_at }  # pure, throws on invalid transition
    listCounsellingRequests()                # service-role, active-only or all
    getCounsellingRequest(id)
    updateCounsellingStatus(id, nextStatus, notes)

app/
  api/
    admin/
      counselling/
        [id]/route.ts    # PATCH — requireAdmin(), validates transition, updates row
  admin/
    counselling/
      page.tsx            # list, active-only default + ?all=1 toggle
      [id]/
        page.tsx           # detail (server component)
        CounsellingStatusForm.tsx  # client component: dropdown + notes + save
    layout.tsx             # add "Counselling" nav link
```

## Data flow

**`nextCounsellingState(current, next)`** — pure function, TDD'd like `computeFunnelStage` (slice 3) and `findUnpaidUnlocks` (slice 4). Given current status and requested next status, returns the row patch (`status`, `scheduled_at`, `completed_at`) or throws if the transition isn't in the allowed graph (Decision 3).

**`listCounsellingRequests(includeAll = false)`**:
- All `counselling_requests` rows, optionally filtered to `status in ('requested','scheduled')`.
- Candidate email enriched via `fitment_leads` keyed by `user_id`, same `emailByUser` pattern as `adminPayments.listTransactions()`.
- Sorted by `requested_at` ascending (oldest-first — queue convention: oldest unhandled request first).

**PATCH `/api/admin/counselling/[id]`**:
- `requireAdmin()` gate.
- Body: `{ status: string, notes?: string }`.
- Calls `nextCounsellingState(currentRow.status, body.status)` — 400 on invalid transition.
- `updateCounsellingStatus(id, patch, notes)` writes via service-role client.

## Error handling

- Invalid transition attempted (e.g. stale client state, direct API call) → 400 with message, form shows inline error, no partial write.
- List page: empty active queue → "Queue is empty — nothing to schedule." Empty `?all=1` → "No counselling requests yet."
- Drill-down for nonexistent `id` → `notFound()`, matching slice 3's per-candidate 404 convention.

## Explicitly out of scope

- Counsellor assignment field — not requested, no multi-counsellor concept exists yet.
- Notification/email on status change — out of scope, no email-sending convention established for admin actions yet.
- Bulk status-change (multi-select) — single-row drill-down only, matches queue size expectations for v1.
- Undo past `completed`/`cancelled` (Decision 3) — terminal by design.

## Testing

- `lib/adminCounselling.ts`: table-driven tests on `nextCounsellingState` covering every valid transition (timestamp side-effects) and every invalid transition (throws) — same TDD approach as slices 3/4.
- API route: not unit-tested (repo has no route-handler test convention elsewhere either — matches existing coverage boundary).
- Pages: manual verification against real data, matching slices 2/3/4 convention (no page-level tests in this repo's admin surface).
