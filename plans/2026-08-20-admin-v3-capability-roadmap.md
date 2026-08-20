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
- **Resync-lock vs. reinvite-unlock (blocks Phase 4/5):** if an admin overrides an interview-report field, then a legit reinvite happens, should the override be respected or overwritten? Unresolved — needs a real decision, not just a "lock the field" gesture.
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

- Audit log viewer page (`admin_audit_log` is written to already — no page reads it back)
- Wire the 3 action types still missing logging: counselling status change, interview generate/reinvite, share-link revoke
- Revert-from-audit-log button (natural extension once the viewer exists)
- `contact_detail_requests` admin page (migration `0030` exists, zero admin surface — a whole feature area is currently invisible; matches the unbuilt `2026-08-10` recruiter-contact-requests design doc)
- Admin-activity analytics (cheap once the audit viewer exists)

## Phase 2 — Security hardening

- MFA on the admin account (currently magic-link email is the only factor)
- Destructive-action re-verification (don't ride a long-lived session for ban/delete/refund)
- Notification opt-out/suppression check before `SendNotificationAction`/email-template sends
- Fold "no-redeploy to change who's admin" into whatever Phase 3 RBAC ends up being (don't build a separate one-off fix)

## Phase 3 — RBAC (gated on the open decision above)

- If multi-admin is actually needed: roles table, 3 tiers to start (read-only / ops / super-admin), admin add/remove without a redeploy
- Concurrency/collision handling for simultaneous edits (only matters once >1 admin exists)
- If not needed: skip entirely, revisit when it becomes real

## Phase 4 — Data CRUD, low-conflict fields first

Resolve the resync-lock open decision before this phase starts.

- Build the shared pattern once: mandatory reason + diff-preview + "admin-overridden" badge
- Personality report fields, references, candidate profile fields, recruiter-preview settings — all safe, no IntervueBox interaction
- Fitment report fields, lead/role record
- Interview report fields — **last**, since this is the field set that actually collides with IntervueBox resync (Phase 5)
- Raw answer transcript stays view-only always — integrity-sensitive, fix via re-run not hand-edit

## Phase 5 — IntervueBox mirror/sync

- Side-by-side raw-vendor vs. mirror view + manual resync button
- Webhook payload inspector/history
- Resync-lock respecting admin overrides (now that both the lock decision and interview-report editing exist)
- Automated drift-reconciliation — **held**, not sequenced. IntervueBox has a history of correctness bugs; an auto-detector built on a shaky foundation will throw constant false positives. Revisit once the integration itself is more stable.

## Phase 6 — Support tooling

- Global search (candidate email / order ID / interview ID)
- Unified per-candidate activity feed (merges account actions + audit log + notifications + payments into one timeline) — sequence after Phase 1's audit log exists
- Recently-viewed candidates list
- Admin alerting (Slack/email push on pipeline failure, payment failure) — sequence after Phase 1, alerts should fire off audit-logged events
- Recruiter-side action audit (shortlist/request-details/contact-request currently leave no log — distinct from admin's own audit log)
- Duplicate-candidate detection (merge tool is manual-only today; no proactive surfacing)
- Periodic digest email — sequence after Phase 7 has enough analytics to summarize meaningfully

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
