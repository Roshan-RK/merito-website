# Admin Account Management — Design

**Status:** Approved design, not yet planned/implemented.

## Context

First of a wider "what should `/admin` let an admin actually *do*" pass (13-category survey done in brainstorming — CRUD, overrides, billing, RBAC, ops, etc.). This spec covers category 1: **user/account admin** for candidates and recruiters. Remaining 12 categories are separate future specs.

Current state (verified against code/migrations, not assumed):
- Candidates have no `profiles` table — identity is bare `auth.users`; "candidate" is a derived grouping of `fitment_leads` rows by `user_id`. No status/active/banned column exists on any candidate-related table.
- Recruiters have no real account model at all. `recruiter_identities` (0029/0032) is keyed by email, holds `verified_at` + free-text `company_name` — no `auth.users` link, no session, no password. Extension recruiters authenticate via a single shared build-time key with no per-recruiter identity whatsoever.
- No audit log table exists yet (B3 spec, `plans/2026-08-12-admin-audit-trail-design.md`, is design-only).
- Supabase Auth Admin API already natively supports ban/unban (`updateUserById` with `ban_duration`), delete user, and generating a magic link for any user — no need to hand-roll these for candidates.
- Only existing admin mutation pattern in the codebase is `adminCounselling.ts`'s gated status state-machine (`ALLOWED_TRANSITIONS`) — reused here as the shape for gated actions.

## Scope

**In scope — candidates:**
- Ban / unban (Supabase Admin API `ban_duration`)
- Delete / anonymize account
- Generate magic link for a candidate (admin-initiated support access / impersonation)
- Merge duplicate accounts

**In scope — recruiters:**
- Ban / unban a `recruiter_identities` row (new `banned_at` column — no Admin API equivalent since there's no `auth.users` row)
- Unverify (clear `verified_at`)
- Edit `company_name`

**Explicitly out of scope:**
- Building real authenticated recruiter accounts (`auth.users`-backed, session-based) — that's a separate, larger future sub-project the recruiter-extension roadmap already tracks.
- RBAC / multiple admin roles — still single `ADMIN_EMAIL` gate.
- Credits system — belongs to the separate, still-unspecced reveal-credits design.
- Any candidate/recruiter self-service UI — admin-only.

## Data model changes

New migration `0034_admin_account_management.sql`:

```sql
-- shared audit log (builds out B3's speced-but-unbuilt table now)
create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null,              -- e.g. 'candidate.ban', 'candidate.merge', 'recruiter.ban'
  target_type text not null,         -- 'candidate' | 'recruiter'
  target_id text not null,           -- user_id (candidate) or email (recruiter)
  prior_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_target_idx on admin_audit_log(target_type, target_id, created_at desc);

-- recruiter ban support (no auth.users row to ban via Admin API)
alter table recruiter_identities add column banned_at timestamptz;
```

`admin_audit_log` is deliberately generic (not candidate/recruiter-specific tables) so B3's remaining scope — logging the *existing* counselling/share-link/interview-recovery actions — can write to the same table later without a second migration.

## Candidate actions (`lib/adminCandidates.ts` additions)

- `banCandidate(userId, reason)` — calls `supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "876000h" })` (~100 years, matches "indefinite" with Supabase's API shape), writes audit row with `prior_value: null, new_value: { banned: true, reason }`.
- `unbanCandidate(userId)` — `ban_duration: "none"`, audit row.
- `deleteCandidate(userId)` — `supabaseAdmin.auth.admin.deleteUser(userId)`. Related rows (`fitment_leads`, `report_unlocks`, etc.) are left in place (already reference a now-deleted `user_id`; existing `listCandidates()` grouping already tolerates the FK pointing nowhere since candidate identity is derived from lead rows, not a join) — audit row records the full prior data snapshot (all lead rows for that `user_id`) in `prior_value` before deletion, since it's the only remaining record.
- `generateCandidateMagicLink(email)` — `supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email })`, returns the link to the admin UI (copy-to-clipboard, not auto-navigated), audit row logs that a link was generated (not the link itself, to avoid storing a live credential in the log).
- `mergeCandidateAccounts(keepUserId, mergeUserId)` — single Postgres transaction: `update` each of `fitment_leads`, `report_unlocks`, `fitment_interviews`, `personality_tests`, `reference_checks`, `report_share_links`, `contact_detail_requests`, `recruiter_preview_settings` setting `user_id = keepUserId where user_id = mergeUserId`, then ban `mergeUserId` (don't delete — keeps the losing account inert but the audit trail intact). Audit row logs both IDs and per-table row counts moved.

## Recruiter actions (new `lib/adminRecruiters.ts`)

- `banRecruiter(email, reason)` / `unbanRecruiter(email)` — sets/clears `recruiter_identities.banned_at`. **`recruiterIdentity.ts`'s verification-check call sites must reject when `banned_at is not null`** — this is the one behavior change outside pure admin code, called out explicitly so it isn't missed during implementation.
- `unverifyRecruiter(email)` — clears `verified_at`, forcing re-verification on next use.
- `updateRecruiterCompany(email, companyName)` — direct update, audit-logged with prior/new value.

No `listRecruiters()`/detail page exists yet either — new `app/admin/recruiters/page.tsx` (list, reuses B1's not-yet-built search/filter table shell if available by then, otherwise the plain `Table` component from sub-project A) + `app/admin/recruiters/[email]/page.tsx` (detail + actions), following sub-project A's existing page/component conventions exactly (Toast, ConfirmDialog, Badge, etc.).

## API routes

- `POST /api/admin/candidates/[userId]/ban` `{ reason }`
- `POST /api/admin/candidates/[userId]/unban`
- `DELETE /api/admin/candidates/[userId]`
- `POST /api/admin/candidates/[userId]/magic-link`
- `POST /api/admin/candidates/merge` `{ keepUserId, mergeUserId }`
- `POST /api/admin/recruiters/[email]/ban` `{ reason }`
- `POST /api/admin/recruiters/[email]/unban`
- `POST /api/admin/recruiters/[email]/unverify`
- `PATCH /api/admin/recruiters/[email]` `{ companyName }`

All routes: `requireAdmin()` guard (existing), Zod-validated body, wrapped `try/catch` returning `Response.json({ error }, { status: 500 })` on failure (matches the pattern item 5 of the backend-hardening spec is already fixing elsewhere), write to `admin_audit_log` on success before returning.

## UI

- Candidate detail page (`app/admin/candidates/[userId]/page.tsx`) gets a new "Account" action block alongside the existing share-links/interview-recovery blocks: Ban/Unban button, Delete button, "Generate magic link" button (shows link in a copy-able field, doesn't auto-open it), "Merge into another account" flow (search-select the target account, confirm).
- All destructive actions (ban, delete, merge) go through the existing `ConfirmDialog` component from sub-project A — matches the pattern already used for share-link revoke and interview recovery.
- New `app/admin/recruiters/` list + detail pages, styled per sub-project A's shell/component conventions.

## Error handling

- Ban/delete/merge on an already-banned/already-deleted/nonexistent target: `409` with a specific message, surfaced via the existing `Toast` component — no silent no-ops.
- Merge validates both `userId`s exist and are distinct before starting the transaction; a mid-transaction failure rolls back entirely (single Postgres transaction, not sequential unguarded updates).

## Testing

Follows this repo's existing mocked-Supabase-client `vitest` convention (`lib/__tests__/admin*.test.ts`):
- `adminCandidates.ts`: ban/unban/delete/magic-link happy paths, merge's per-table row-reassignment logic (mocked multi-table update), audit-row content assertions for each.
- `adminRecruiters.ts`: same shape, plus a test that `recruiterIdentity.ts`'s verification check actually rejects a banned email (the one cross-cutting behavior change).
- Route tests for all 9 new endpoints: happy path, `requireAdmin()` rejection (401), validation failure (400), not-found (404/409).

## Open item carried from sub-project A

Not this spec's scope, but the merge/delete flows above make it more relevant: sub-project A's Task 7 `ConfirmDialog` backdrop-click-bypasses-`busy` issue is still unresolved (human decision pending, noted in that session's ledger). Worth resolving before this spec ships its own destructive-action dialogs on the same component.
