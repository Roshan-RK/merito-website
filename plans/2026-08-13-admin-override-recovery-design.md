# Admin Override / Stuck-State Recovery — Design

**Status:** Approved design, not yet planned/implemented.

## Context

Third of the 13-category admin-capability survey (#1 account management, #2 dropped — no real gap, #3 this doc). Unlike #2's rejected raw-CRUD idea, every item here is a confirmed, evidenced gap: a real async/external step with no recovery path today, found by tracing actual failure modes in the code (not a generic SaaS checklist).

Reuses `admin_audit_log` from the account-management spec (`plans/2026-08-13-admin-account-management-design.md`) — every action below writes to it.

## Items

### A. Payment consumed, no interview created (critical — real money lost)

`app/api/hub/start-ai-interview/route.ts` consumes the Razorpay credit (`consumed_at` set) *before* the IntervueBox invite chain runs. If `sendInterviewInvitation` succeeds but the subsequent `fitment_interviews` insert fails for a non-unique-violation reason, the code's own comment admits: "IntervueBox-side records now exist with no Merito row pointing at them — log the IDs so this can be manually traced." Currently: `console.error` only. Candidate is out the payment with nothing to show for it.

**Fix:** new `pipeline_failures` table (migration `0035`):

```sql
create table pipeline_failures (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('interview_invite_after_payment', 'orphaned_ib_job')),
  user_id uuid,
  lead_id uuid references fitment_leads(id),
  order_id text references razorpay_transactions(order_id),
  detail jsonb not null,          -- ib_agent_id, ib_candidate_id, role_title, error message, etc.
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);
create index pipeline_failures_unresolved_idx on pipeline_failures(kind, created_at) where resolved_at is null;
```

`start-ai-interview/route.ts`'s catch block writes a `kind='interview_invite_after_payment'` row here instead of (in addition to) the console.error, capturing everything needed to fix it without re-calling IntervueBox: `ib_agent_id`/`ib_candidate_id` already exist on the vendor side.

**Admin action:** `POST /api/admin/pipeline-failures/[id]/retry-interview` — inserts the missing `fitment_interviews` row directly from the stored IDs (external side already succeeded, no IntervueBox call needed), marks `resolved_at`. Second action `POST .../refund` — out of scope here, hands off to category #5 (billing) spec; this route just marks the failure resolved after a manual refund is issued elsewhere.

### B. Orphaned IntervueBox job (lower severity — no payment lost)

`lib/intervuebox/jobs.ts::createJob()` succeeds but a later step (`uploadResume`/`addApplicantWithRetry`) fails — no local row is ever written, only a console.error. Same `pipeline_failures` table, `kind='orphaned_ib_job'`. **Admin action:** `POST /api/admin/pipeline-failures/[id]/discard` — just marks resolved; the dangling IntervueBox-side job/resume costs nothing and isn't worth vendor-side cleanup tooling.

Shared UI: `app/admin/pipeline-failures/page.tsx` — list of unresolved rows (both kinds), grouped by `kind`, each with its one available action.

### C. Force-generate interview report despite bad remote status

Extends existing `InterviewRecoveryActions.tsx`/`generate` route. Spec C (backend-hardening) is adding a guard requiring IntervueBox status `TERMINATED` before generating — this adds an escape hatch for when that guard is wrong (candidate actually finished, IntervueBox status is stale/incorrect). New secondary button, danger-styled, distinct from the normal Generate button: "Force generate (bypass status check)" — routes to the same `generate` endpoint with `?force=true`, which skips the `TERMINATED` check. Logs `interview.force_generate` to `admin_audit_log` with the remote status seen at the time, so a bad force-generate is traceable.

### D. `fitment_leads.resume_match_status` stuck at `PENDING` forever

No poller covers this (unlike interviews, which get a webhook sweep + 2 self-heal polls). If the candidate never revisits the report page after submitting, the row sits `PENDING`, `score=0`, `verdict=''` with zero admin visibility beyond a static "Fitment report not ready yet" string.

**Fix:** `lib/adminCandidates.ts::retryResumeMatch(leadId)` — re-calls the same `getResumeMatchReport()` used by the existing candidate-facing poll route, updates the row if IntervueBox now has a result. Add a "Retry" button next to the existing "not ready yet" text on the candidate detail page — no new list page needed (B1's future search/filter will surface these once built; don't duplicate that work now).

### E. Referee stuck past `MAX_REMINDERS`

`lib/referenceChecks.ts`'s reminder sweep (`getStaleRefereesForReminder()`) permanently excludes any referee at `reminder_count >= MAX_REMINDERS` (3). `reference_checks.status` stays `in_progress` forever if too few referees ever respond, with no way to unstick one.

**Fix:** `lib/referenceChecks.ts::resetRefereeReminders(refereeId)` — sets `reminder_count = 0`, re-admitting it to the existing sweep. Button on the (currently read-only) `RefereeSummary.tsx`. Replacing a stuck referee with a different person entirely is a bigger change (new token, invalidate old) — **out of scope for this spec**, reset-and-let-the-existing-sweep-retry covers the actual failure mode found.

### F. Payment reconciliation retry

`lib/adminPayments.ts::listUnpaidUnlocks()` already flags unlocks with no matching successful payment, read-only. **Fix:** `recordManualReconciliation(leadId, productType)` — same pattern as the `RAZORPAY_BYPASS` tracking fix in the backend-hardening spec: inserts a `razorpay_transactions` row (`order_id: 'manual_' + uuid`, `status: 'success'`, `amount_paise`: admin-entered actual amount verified out-of-band, `consumed_at: now`), so the row disappears from the mismatch report and there's a real audit trail of *why* — not a silent write, `admin_audit_log` records the admin-entered amount and lead ID.

## API routes

- `POST /api/admin/pipeline-failures/[id]/retry-interview`
- `POST /api/admin/pipeline-failures/[id]/discard`
- `POST /api/admin/interviews/[id]/generate?force=true` (extends existing route, new query param)
- `POST /api/admin/candidates/[leadId]/retry-resume-match`
- `POST /api/admin/referees/[id]/reset-reminders`
- `POST /api/admin/payments/reconcile` `{ leadId, productType, amountPaise }`

All: `requireAdmin()`, Zod-validated, `try/catch` → structured JSON error, `admin_audit_log` write on success.

## UI

- New `app/admin/pipeline-failures/page.tsx` (list + per-row action), added to `AdminSidebar` nav.
- Candidate detail page: "Retry" button next to stuck resume-match text; existing interview block gets the new "Force generate" danger button next to the current Generate button.
- `RefereeSummary.tsx` (currently read-only) gets a "Reset reminders" button per stuck referee.
- `/admin/payments` unpaid-unlocks section gets a "Reconcile" button per row, opening a small form (amount + confirm) instead of a bare action — this one needs an amount input, not just a confirm dialog, since the correct amount must come from the admin verifying the real payment out-of-band.

## Error handling

- Force-generate always succeeds at the route level (bypasses the check by design) but the resulting report should be visually flagged if the remote status wasn't `TERMINATED` — reuse `Badge` (warning variant) on the candidate page report block when `admin_audit_log` shows a force-generate with non-terminal status, so a human reviewing later sees it wasn't a normal completion.
- Reconciliation form requires a non-zero amount confirmation step (`ConfirmDialog` showing the entered amount before submit) — this one writes financial data, needs an explicit double-check unlike the pure-recovery actions (C–E) which just retry a known-safe operation.

## Testing

Standard `vitest` + mocked-Supabase convention:
- `pipeline_failures` insert paths: unit test that `start-ai-interview`'s catch block and `createJob`'s caller's catch block each write the expected row shape.
- `retry-interview`, `discard`, `force-generate`, `retry-resume-match`, `reset-reminders`, `reconcile` route tests: happy path, `requireAdmin()` 401, validation 400, not-found/already-resolved 409.
- `resetRefereeReminders`: assert the sweep's own query (`reminder_count < MAX_REMINDERS`) now includes the referee post-reset (integration-style test against the existing sweep function, not just the reset function in isolation).

## Explicitly out of scope

- Automatic (non-admin-triggered) recovery for any of these — B1-B3/C already established the pattern of admin-visible, admin-triggered fixes for this scale of ops volume; building cron-based auto-retry for A/B/D is disproportionate until failure volume is actually measured (the `pipeline_failures` table itself gives you that measurement for the first time).
- Refund issuance (A's second half) and replace-referee (E's bigger version) — both deferred to their more natural homes (#5 billing, and a future spec if replace-referee turns out to be needed after reset is observed in practice).
