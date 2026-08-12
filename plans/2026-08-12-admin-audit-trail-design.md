# Admin Audit Trail — Design

**Status:** Approved design, not yet planned/implemented.

## Context

Fourth sub-project from the 2026-08-12 admin portal audit (prior: sub-project A shell, B1 list UX, B2 drill-down navigation — `plans/2026-08-12-admin-*-design.md`). Backend audit finding (Low severity): zero logging of who did what, when, or what the prior value was, across every admin mutation. Single `ADMIN_EMAIL` makes "who" currently moot, but "when + prior value" is unrecoverable after the fact today — e.g. a counselling request gets marked `cancelled` and there's no record of what it was before or when it changed.

Depends on sub-project A's `Table` component and B1's `Pagination` component for the viewer page.

## Decisions

1. **New `admin_actions` table**, not reuse of an existing table or a generic events table — this is the first write-audit surface in the schema, no existing table fits.
2. **`target_id` is `text`, not `uuid`.** Three of the four logged actions have UUID targets (`counselling_requests.id`, `fitment_interviews.id` ×2), but the share-link revoke route targets by raw token string, not a UUID — a `uuid` column would reject that row. `text` accepts both without a lossy cast.
3. **RLS enabled, zero public policies** — matches every other table's pattern confirmed in the backend audit (RLS on, service-role client bypasses by design, no client-side access path exists or should exist). Only `lib/adminActions.ts` (service-role) ever touches this table.
4. **Best-effort write, not transactional with the mutation.** The log insert happens after the real mutation succeeds. Supabase's service-role JS client has no simple multi-statement transaction primitive without writing a Postgres RPC function — disproportionate infrastructure for a single-admin internal tool's nice-to-have audit trail. Accepted risk: a mutation can succeed with no corresponding log row if the log insert itself fails. A failed log write is logged to `console.error`, not silently swallowed (consistent with the "no more swallowed errors" direction from sub-project C).
5. **No filters on the v1 viewer page** — plain reverse-chronological list. Add filtering (`?action_type=`, `?target_table=`) later if the list actually grows long enough to need it; premature at 4 action types and today's mutation volume.

## Architecture

```
supabase/migrations/
  00NN_admin_actions.sql        # next available migration number at implementation time
    -- admin_actions(id uuid pk, action_type text, target_table text, target_id text,
    --   actor_email text, prior_value jsonb, new_value jsonb, created_at timestamptz default now())
    -- RLS enabled, no policies (service-role only)
lib/
  adminActions.ts                # logAdminAction({ actionType, targetTable, targetId, actorEmail, priorValue, newValue }), listAdminActions({ page })
app/api/admin/
  counselling/[id]/route.ts      # after successful updateCounsellingStatus(), call logAdminAction(...)
  share-links/[token]/route.ts   # after successful setShareLinkRevokedByToken(), call logAdminAction(...)
  interviews/[id]/generate/route.ts   # after successful generateInterviewReport(), call logAdminAction(...)
  interviews/[id]/reinvite/route.ts   # after successful reinviteInterviewCandidates(), call logAdminAction(...)
app/admin/
  activity/page.tsx              # new nav item, reverse-chronological Table + Pagination
```

`actor_email` is read from the same `requireAdmin()` call each route already makes — no new auth lookup needed, just threading the existing `user.email` value into the log call.

## Data flow

Each of the 4 routes gains one extra `await logAdminAction(...)` call after its existing mutation, wrapped in its own `try/catch` so a log failure can never cause the actual admin action to appear to fail (the response to the admin is unaffected by log success/failure). `prior_value`/`new_value` are small JSON snapshots — e.g. counselling logs `{ status: "requested" }` → `{ status: "scheduled", notes: "..." }`, share-link logs `{ revoked: false }` → `{ revoked: true }`, interview generate/reinvite log `{ requestedAt: null }` → `{ requestedAt: "<iso>" }` (or just `{ triggered: true }` for reinvite, which has no persisted state to diff).

## Error handling

Log-write failures are caught locally at each call site, logged to `console.error` with enough context to manually reconstruct what happened (action type, target id, timestamp), and otherwise ignored — the admin-facing response is unaffected. The viewer page has no special error handling beyond what every other admin list page already has (unhandled fetch errors bubble to the route's error boundary).

## Explicitly out of scope

- Backend hardening (sub-project C) — this doc assumes the 4 mutation routes' *existing* behavior, doesn't fix their race conditions or idempotency gaps.
- Filtering/search on the activity log (deferred, noted above).
- Retention/archival policy for `admin_actions` rows — table grows unbounded for now; revisit if it ever becomes a real volume concern (unlikely at single-admin, 4-action-type scale for a long time).
- Logging read-only actions (viewing a candidate, viewing payments) — only mutations are logged.

## Testing

`lib/adminActions.ts`'s `logAdminAction`/`listAdminActions` are thin Supabase wrappers (same category as the existing untested `adminExtension.ts`/`adminLearnedSkills.ts`, per the backend audit) — no complex pure logic to unit test. Each of the 4 route handlers gaining a `logAdminAction` call should have their existing `__tests__/route.test.ts` updated to assert the log call happens on success and is skipped/doesn't block on failure, following this repo's existing route-test convention. Viewer page verified manually (same browser-check convention as A/B1/B2).
