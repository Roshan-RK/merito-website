# Interview retake via reinvite — design

**Date:** 2026-08-10
**Status:** Approved, ready to build

## Current state (most of the old retake plan is already live)

`plans/2026-07-27-interview-retake-payment-plan.md` planned paid retakes. Checked against the current tree — done already:

- **Schema:** `0019_fitment_interviews_multi_attempt.sql` applied — surrogate `id` PK, partial unique index `one attempt "invited" per (user_id, role_title)` at a time. Multiple historical rows per role already supported.
- **Webhook:** `app/api/webhooks/intervuebox/route.ts` already targets/updates by row `id`, not `(user_id, role_title)`.
- **Razorpay:** `interview` is in `INITIATABLE_PRODUCTS` (`razorpay/initiate/route.ts`); `finalize.ts` has no `interview` rejection branch — a successful payment already just falls through to `status: "success"`.
- **Payment gate + credit consumption:** `start-ai-interview/route.ts` already checks/consumes an unconsumed `interview` Razorpay transaction when `RAZORPAY_BYPASS=false`.

Not done — the one thing that's actually missing:

- `start-ai-interview/route.ts` hard-blocks **any** second attempt for a role with a 409 (`753cf26`, 2026-08-05), because the retake implementation *at that time* created a brand-new IntervueBox job per attempt but reused the candidateId from the original job — invalid, since IntervueBox scopes candidates per-job. Blocking was the safe call at the time; there was no cheap fix without re-collecting the CV.
- Today's discovery changes that: `reinviteInterviewCandidates` (`POST /public/invitations/interviews/:interviewId/reinvite`, added this session, vendor-confirmed 2026-08-10) reuses the **same** job/agent/candidate — live-verified working even against an already-`EVALUATED` interview (`201`, real test against a real candidate this session). No new job, no candidateId mismatch.
- `ProgressRail.tsx`'s "Retake" trigger was removed in the same `753cf26` commit — nothing currently reachable from the dashboard for a `ready` interview besides "View report".

## Decision

Retake = reuse the prior attempt's `ib_job_id`/`ib_agent_id`/`ib_candidate_id` via `reinviteInterviewCandidates`, insert a **new** `fitment_interviews` row (fresh `id`, same IntervueBox IDs, `status: "invited"`) so the prior attempt's `report_raw` stays intact as history. No new IntervueBox job is ever created for a retake — only the first-ever attempt for a role calls `createInterviewAgent`.

## Changes

**`start-ai-interview/route.ts`:** replace the current unconditional `priorAttempt` 409-block with a branch:
- No prior row at all → existing first-attempt path (`createInterviewAgent` + `sendInterviewInvitation`), unchanged.
- Prior row exists with `status: "ready"` → payment-gate as already implemented, then call `reinviteInterviewCandidates(priorAttempt.ib_agent_id, [priorAttempt.ib_candidate_id])` instead of the create-agent chain, then insert the new row with those same three IntervueBox IDs.
- Prior row exists with `status: "invited"` (attempt in progress) → unchanged, still returns the existing `invited` status idempotently, no payment/reinvite fired.

**`ProgressRail.tsx`:** re-add the "Retake" badge/trigger for `interviewStatus === "ready"` (mirrors the one removed in `753cf26`), calling a new `onOpenInterviewRetake` callback.

**`DashboardClient.tsx`:** wire `onOpenInterviewRetake` to open `InterviewPaywallModal` in its normal (payment-required) mode — same modal already used for the first attempt, no `alreadyInvited` skip.

## Out of scope

- Admin-side free resend (`InterviewRecoveryActions.tsx`, `/api/admin/interviews/:id/{reinvite,generate}`) — already built, already correctly free/admin-gated, not touched by this change.
- No new "past attempts" browsing UI — matches the original plan's stated non-goal; dashboard keeps showing only the latest attempt (`order by updated_at desc limit 1`, already the existing query pattern).
- Reinvite behavior on a `status: "invited"` (not yet completed) prior attempt is untested this session — not needed for this design since that state is already handled (idempotent return, no reinvite call).

## Testing

- `start-ai-interview` route test: prior `ready` row + `RAZORPAY_BYPASS` on → calls `reinviteInterviewCandidates` with the prior row's IDs, not `createInterviewAgent`; inserts a new row reusing those same `ib_job_id`/`ib_agent_id`/`ib_candidate_id`.
- Same test, `RAZORPAY_BYPASS=false`, no credit → 402, no reinvite call.
- `ProgressRail` test: `interviewStatus === "ready"` renders the Retake trigger and calls `onOpenInterviewRetake` on click.
