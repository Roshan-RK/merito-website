# Admin v3 capability roadmap

Backlog + sequencing from a multi-pass brainstorm (2026-08-20), scoped to Merito Hub's `/admin`. Every item below was checked against actual code, not assumed — see the two "verified gap map" turns in that session for what was corrected along the way (audit logging was initially over-claimed as unused; it's actually wired into 17 of ~20 action types already).

Explicitly out of scope for this roadmap: ATS integration (separate product, not being looked at now).

## Execution conventions (apply to every phase/item)

- **Vertical slices, not horizontal layers.** Within one item: schema/migration → `lib/` function (+ audit log call) → API route → client component/page, in that order — frontend needs the data contract to exist first. But don't do "all backend for every phase, then all frontend for every phase" — ship each item full-stack before starting the next, same as every existing `/admin` section was built. Exception: read-only UI can ship ahead of its write-path backend when useful (view first, mutate later).
- **UX covers every case, not just the happy path.** For each item, explicitly design: empty state (use `EmptyState`), loading state (pages are server-rendered today with no skeleton — add one where a query is slow enough to matter), error state (currently toast-only for action failures; page-load failures need a persistent error state too, not just a blank page), large-data state (pagination, once Phase 0 wires it up), permission/auth edge cases (already handled by `requireAdmin()` — wrong admin 404s, no session redirects), destructive-action confirmation (`ConfirmDialog`, extend to type-to-confirm per Phase 0), and concurrent-edit conflicts (Phase 3, once multi-admin is real). Non-goals, stated explicitly so they don't get retrofitted by accident: mobile/responsive layout, dark mode — this is a desktop-only internal tool.

## Schema readiness (checked against all 42 current migrations)

**Already there, no new schema needed:**
- Phase 1 audit viewer/revert — `admin_audit_log` (migration `0034`) has everything: admin_email, action, target_type, target_id, prior_value, new_value, created_at
- Phase 1 `contact_detail_requests` page — table (migration `0030`) already has a full approve/deny workflow (`status`, `decided_at`, `decided_by`). This item is UI+route wiring only, not a data-model build
- Phase 4 editing fitment/personality report content — `fitment_reports` and `personality_tests` store scores/summaries as normal jsonb/text columns, directly `UPDATE`-able
- Candidate ban already uses Supabase's native `auth.admin.updateUserById(userId, { ban_duration })` — reversible suspension already exists as infra, distinct from delete

**Confirmed schema gaps (need a migration):**
- ~~Share-link TTL~~ — closed by migration `0045` (see Phase 0).
- ~~Rate limiting~~ — closed by migration `0046` (see Phase 0). Postgres table, not KV.
- Notification opt-out — `hub_notifications` (migration `0037`) has no suppression/opt-out column, no preferences table
- RBAC — no `admins`/roles table exists anywhere
- Admin-overridden tracking (Phase 4) — no such column exists on any report table yet; needs a design decision (one column per table vs. one generic table) before Phase 4 starts
- Full webhook payload history (Phase 5) — `pipeline_failures.detail` (migration `0035`) only captures failure cases, not the full webhook stream

**Correction — changes how Phase 0's "soft-delete" item should be scoped:**
`deleteCandidate()` (`lib/adminCandidates.ts`) only calls `auth.admin.deleteUser(userId)`. It does **not** delete `fitment_leads`, `fitment_interviews`, `personality_tests`, `reference_checks`, or `report_share_links` rows — those are silently orphaned (user_id pointing at a deleted auth user), not purged. Today's "delete" is neither a clean hard-delete (data lingers) nor a tracked soft-delete (no `deleted_at`, no way to distinguish an orphaned row from a live one without querying the auth admin API). This is a real gap, and arguably a bigger one than originally scoped: right now, "deleting" an account does not satisfy a GDPR-style erasure request at all — it just revokes login. Phase 0's item needs to become an explicit choice: (a) actually cascade-delete the personal-data tables too, or (b) soft-delete with a real `deleted_at` marker and a defined retention/purge window. Neither exists today.

## Open decisions (resolve before the phase that needs them)

- **RBAC (Phase 3):** only one admin account exists today (`roshan@merito.in`). Confirm actual need for multi-admin before building — don't build speculatively.
- ~~Resync-lock vs. reinvite-unlock~~ — **resolved 2026-08-21: manual override always wins.** Reinvite on an already-`'ready'` interview row was already found to never touch `report_raw` (see Phase 4), so this only needed real enforcement for fitment (`resume_match_overridden` flag blocks `retryResumeMatch()`). Candidate profile fields needed a third mechanism entirely (override table wins on read, nothing to lock since nothing is cached).
- **Impersonate-as-candidate:** highest-liability item on the list, marginal value since the candidate-detail page already shows the same data read-only. Reconsider before building, not default-yes.
- **Command palette / sticky filters / other power-user UI:** contradicts the admin's current deliberately minimalist styling (see the recent reskin work). Decide as a philosophy call before adding.
- **Terms/consent version tracking:** more a legal/compliance-ownership question than an engineering one — raise with whoever owns ToS rather than sequencing as a normal build item.

## Phase 0 — Quick wins (no dependencies, ship immediately)

**All items below shipped 2026-08-20. Phase 0 complete.**

- ~~Wire `Pagination.tsx` into candidates/payments tables~~ — **shipped.** `listCandidates(page)`/`listTransactions(page)` fetch-all-then-slice-in-JS (minimal scope, chosen over full sub-project B's DB-level pagination), `Pagination.tsx` reworked from client-callback to server Link-based, wired into both pages.
- ~~Share-link expiry/TTL~~ — **shipped.** Migration `0045` adds `expires_at` to `report_share_links`; `createOrUpdateShareLink` sets a 90-day TTL on every create/regenerate, `validateShareToken` rejects expired tokens (`reason: "expired"`). Admin candidate detail page shows an Expires column + Expired badge.
- ~~Soft-delete instead of hard delete~~ — **shipped 2026-08-20.** `deleteCandidate()` now bans the account (reversible, reuses the existing ban mechanism) and records a `candidate_deletions` row with a 30-day `purge_after`; `restoreCandidate()` undoes it. Migration `0043`. Cross-table erasure fast-follow also **shipped**: `purge_candidate_data()` (migration `0044`) + `purgeDueCandidateDeletions()` cron erase the 9 FK-linked tables once `purge_after` passes.
- ~~Rate limiting on admin mutation endpoints~~ — **shipped.** `enforceAdminRateLimit()` (migration `0046`, `admin_rate_limit_events` table) caps each admin to 20 actions per action-type per 10-minute window; wired into ban (candidate + recruiter), delete, refund, grant. Postgres-backed rather than KV — no new external service/credentials needed, matches this repo's existing Supabase-for-everything convention.
- ~~Type-to-confirm pattern on danger actions~~ — **shipped.** `ConfirmDialog` takes an optional `confirmText` prop that locks the confirm button until retyped exactly; applied to the two truly hard-to-reverse actions (candidate delete — type the email; refund — type "REFUND"). Ban/revoke/discard left as plain confirm — reversible and too frequent to add friction to.

## Phase 1 — Admin-ops foundation

**Shipped 2026-08-20**, except revert (deferred, see below).

- ~~Audit log viewer page~~ — **shipped.** `/admin/activity`, `listAdminActions(page)` (real DB `range()` pagination, not JS-slice — this table is explicitly unbounded-growth per the audit-trail design doc). Links out to candidate/recruiter/email-template targets where applicable.
- ~~Wire the 3 action types still missing logging~~ — **shipped.** `counselling.status_change`, `share_link.set_revoked`, `interview.generate`, `interview.reinvite` (4 routes, matches the approved `2026-08-12-admin-audit-trail-design.md` exactly — best-effort write, own try/catch, never blocks the actual action).
- Revert-from-audit-log button — **deferred, not built.** No approved design exists for this (unlike the other 3 items, which had `2026-08-12-admin-audit-trail-design.md`). `prior_value` shapes differ per action type (a ban reason vs. a counselling note vs. a raw share-link token vs. interview state) — a generic "revert" needs per-action-type semantics specified first, not a blind `UPDATE ... SET x = prior_value`. Needs its own design pass before building.
- ~~`contact_detail_requests` admin page~~ — **shipped, but scope corrected.** Investigation found the `2026-08-10` design doc's admin-approval-gate was never actually built that way: `lib/contactDetailRequests.ts::logAndGetContactEmail()` auto-approves and reveals on every request (gated only by the candidate's own `recruiter_preview_settings.enabled` toggle, not an admin decision) — `status`/`decided_by` are always `'approved'`/`'auto'`, nothing is ever `'pending'`. Built `/admin/contact-requests` as a read-only audit trail of reveals (matches what the system actually does), not an approve/deny queue (would have been non-functional UI — the backend doesn't gate on status at all).
- ~~Admin-activity analytics~~ — **shipped, minimal.** 3 count tiles (24h/7d/30d) on the `/admin/activity` page itself, not a separate page — matches the roadmap's own "cheap" framing.

## Phase 2 — Security hardening

- ~~Destructive-action re-verification~~ — **shipped 2026-08-20.** `assertRecentAuth()` (`lib/adminAuth.ts`) requires the admin's `last_sign_in_at` within 30 min, not just session validity — Supabase refresh tokens keep sessions alive indefinitely otherwise. Wired into ban (candidate + recruiter), delete, refund via a 401 in each route's existing catch block. 8 new tests.
- ~~Notification opt-out/suppression check~~ — **dropped, premise didn't hold.** Investigated both named send surfaces: `sendTestEmail` (email-templates admin page) only ever sends to the *admin's own inbox* as a preview, never to a candidate. `SendNotificationAction`/`sendCandidateNotification` only inserts a `hub_notifications` row — in-app only, no email dispatch attached. No candidate-facing email exists on either path today, so there's nothing to suppress. No opt-out schema built.
- MFA on the admin account — **deferred 2026-08-20.** Protects only against inbox compromise; real cost (new login-flow step, lockout risk on a single-admin account, new dependency for QR rendering) weighed against low current attacker-value for an internal tool with one user. Revisit if that changes.
- Fold "no-redeploy to change who's admin" into whatever Phase 3 RBAC ends up being (don't build a separate one-off fix)

## Phase 3 — RBAC (gated on the open decision above)

**Skipped 2026-08-20** — confirmed still single-admin (`roshan@merito.in` only). Revisit when multi-admin is real.

- If multi-admin is actually needed: roles table, 3 tiers to start (read-only / ops / super-admin), admin add/remove without a redeploy
- Concurrency/collision handling for simultaneous edits (only matters once >1 admin exists)
- If not needed: skip entirely, revisit when it becomes real

## Phase 4 — Data CRUD, low-conflict fields first — **COMPLETE 2026-08-21**

Resync-lock decision resolved 2026-08-21: **manual admin edit wins, resync must never silently overwrite it.** Applied per-slice below, mechanism chosen to match what each table actually needed rather than one forced pattern.

- ~~Shared pattern~~ — **shipped 2026-08-20, reused existing infra instead of new schema.** `admin_audit_log` (already existed) doubles as the override history — no new `admin_field_overrides` table needed. `listActionsForTarget(targetType, targetId)` (`lib/adminAuditLog.ts`) fetches full unpaginated history for one record; reason folds into `newValue` jsonb, matching how ban/delete/refund already log reasons. "Admin-overridden" badge = any history rows exist for that action.
- ~~recruiter_preview_settings~~ — **shipped 2026-08-20.** `updateRecruiterPreviewOverride()` (`lib/adminCandidates.ts`) — admin can override `enabled`/`sections` with a mandatory reason; blocks enabling if the candidate has no LinkedIn URL on file yet (same rule the candidate-facing PUT enforces). Candidate detail page's Recruiter Preview section is now an edit form + collapsible history, not static text.
- Personality report fields — **narrow edit surface, deferred.** Only `scores`/`validity` are stored (raw/pct/band per trait); all narrative text is computed from static lookup tables, nothing to edit there. Editing raw trait numbers risks internal inconsistency (raw vs. pct vs. band drifting) for an unclear real use case. Revisit if a concrete need shows up.
- ~~References~~ — **shipped 2026-08-20, scope narrowed after checking the actual schema.** `referees.ratings`/`overall_feedback` are the referee's own submitted testimony — same integrity concern as the raw interview transcript rule below, so those stay view-only, no edit built. What shipped instead: referee **contact/metadata** fixes (name, email, phone, organization) via `updateRefereeContact()` (`lib/referenceChecks.ts`) — real gap, since a typo'd referee email blocked reminders/tokens with no fix available (`reset-reminders` only zeroes the counter, not the address). Added `"referee"` to `AuditTargetType` so history is scoped per-referee, not folded into the candidate's own log.
- ~~Fitment report fields~~ — **shipped 2026-08-21.** `overrideFitmentReport()`/`clearFitmentOverride()` (`lib/adminCandidates.ts`) — admin can correct `overallScore`/`summary` on a ready `fitment_leads` row. Needed a real lock: `retryResumeMatch()` unconditionally overwrote `resume_match_raw` on every retry, so migration `0047` adds `resume_match_overridden boolean`, and retry now refuses to run while it's set — admin must explicitly clear the override first.
- ~~Interview report fields~~ — **shipped 2026-08-21, simpler than the roadmap feared.** `overrideInterviewReport()` — admin can correct `overallScore`/`overallSummary` on a ready `fitment_interviews` row. Investigation found no lock column was actually needed: `sweepPendingInterviews()` only ever touches rows still in `status = 'invited'`, and the admin reinvite route already skips resetting status on an already-`'ready'` row (fixed previously for an unrelated stuck-state bug) — so nothing in this codebase can silently overwrite a manually-edited `report_raw`. Reused the lighter recruiter-preview-style pattern (audit-log history is the only signal) instead of the fitment slice's boolean-flag pattern.
- ~~Candidate profile fields~~ — **shipped 2026-08-21, different mechanism than fitment/interview.** `getCandidateResumeDetails()` fetches live from IntervueBox on every page load — nothing is cached in Merito's DB at all, so there was no local row to flag as "overridden." New `candidate_profile_overrides` table (migration `0048`, `overrideCandidateProfile()`) sits on top of the live fetch and wins unconditionally on read whenever a row exists — phone/location/total-experience only, education/experience/skills/projects/certifications left untouched (narrow scope, matches the 1-2-field precedent set by every other slice).
- Raw answer transcript stays view-only always — integrity-sensitive, fix via re-run not hand-edit

## Phase 5 — IntervueBox mirror/sync

- Side-by-side raw-vendor vs. mirror view + manual resync button
- Webhook payload inspector/history
- ~~Resync-lock respecting admin overrides~~ — done as part of Phase 4 itself (fitment/interview/profile), not deferred to here as originally planned.
- Automated drift-reconciliation — **held**, not sequenced. IntervueBox has a history of correctness bugs; an auto-detector built on a shaky foundation will throw constant false positives. Revisit once the integration itself is more stable.

## Phase 6 — Support tooling

- Global search (candidate email / order ID / interview ID)
- Unified per-candidate activity feed (merges account actions + audit log + notifications + payments into one timeline) — sequence after Phase 1's audit log exists
- Recently-viewed candidates list
- Admin alerting (Slack/email push on pipeline failure, payment failure) — sequence after Phase 1, alerts should fire off audit-logged events
- Recruiter-side action audit (shortlist/request-details/contact-request currently leave no log — distinct from admin's own audit log)
- Duplicate-candidate detection (merge tool is manual-only today; no proactive surfacing)
- Periodic digest email — sequence after Phase 7 has enough analytics to summarize meaningfully
- Broadcast notification to all candidates (or a filtered subset, e.g. by funnel stage) — requested 2026-08-21 after noticing `sendCandidateNotification()` is single-user-only, no global/bulk-send path exists anywhere in the codebase today (confirmed via grep). Needs its own scoping pass: does "all" mean every candidate ever, or filterable by funnel stage/role/date; does it reuse `hub_notifications` (in-app only, no email dispatch attached today) or need an email-send path too

## Phase 7 — Analytics

- Cheap extensions to the existing funnel page first: drop-off %, per-role-title breakdown, revenue analytics beyond the raw list, data-quality dashboard (% missing skillReport etc.)
- Time-series/trend charts (today's `/admin` funnel page is point-in-time only)
- Recruiter engagement funnel — depends on Phase 1's contact-requests page and existing preview-view data
- Score-distribution/correlation analysis — depends on Phase 4's admin-overridden flag existing (an override shouldn't silently corrupt correlation analysis)
- Vendor cost/usage monitoring (IntervueBox spend, resume-match retry costs) — needs a research spike first to confirm the vendor APIs even expose cost data

## Held / not sequenced

- Bulk operations (CSV import/export + async job queue) — no evidenced need at current scale; large effort
- Data/compliance export — build when an actual request needs it, not speculatively
- Impersonate-as-candidate — pending the open decision above
- Nav grouping (Candidates / Recruiters / Payments / Operations / Content / Analytics) — do once the item count actually justifies it, natural trigger around Phase 1-2 completion
- Command palette / sticky filters / other power-user UI — pending the philosophy decision above
- Inline click-to-edit report UX — polish layer on top of Phase 4's basic edit forms, not a first cut
