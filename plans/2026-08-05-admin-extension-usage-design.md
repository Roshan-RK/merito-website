# Extension Usage (Slice 7) — Design

**Status:** Approved design, not yet implemented.

## Context

Slice 7 of `plans/2026-08-05-admin-portal-roadmap.md`, which asks for "install/active counts, lookups performed. No backend telemetry exists yet." Checked `extension/src/background/index.ts` (no `chrome.runtime.onInstalled` handler, no telemetry of any kind) and the `recruiter_preview_pm_priorities` memory: the extension uses a single static shared key (`RECRUITER_EXTENSION_KEY`), not per-recruiter accounts, and has never been published to the Chrome Web Store (submission blockers — icons, privacy policy — still open).

## Decisions

1. **Install/active counts are out of scope.** There is no per-installation identity today — every request carries the same shared key, so "how many recruiters have this installed" can't be derived from anything the backend sees. Building `onInstalled`-ping infrastructure for an extension that isn't even distributed yet is speculative work, not oversight of real usage. Deferred until the extension actually ships (ties to PM priority #1, closing the access-key gap, which would naturally introduce per-recruiter identity).
2. **"Lookups performed" is fully buildable server-side, no extension changes.** `app/api/public/recruiter-preview/lookup/route.ts` already sees every lookup attempt (matched or not) — it just never records it.
3. **Log every well-formed attempt, not just matches.** A lookup that finds nothing is still usage signal (e.g. recruiters searching non-candidates, or candidates who haven't opted in) — logged with `matched_user_id = null`. Malformed input (empty string, fails the LinkedIn URL regex) is not logged — that's a bad request, not a real lookup attempt.
4. **Standalone admin page**, not folded into candidate drill-down. Unlike slice 6 (inherently per-candidate), this is aggregate extension activity — matches slices 4/5's standalone convention (spot recent activity without navigating per-candidate).
5. **RLS enabled with no policies** on the new table (deny-by-default for anon/authenticated; service-role bypasses RLS regardless) — consistent with every other table in this schema, even though there's no current client-facing read path for it.

## Architecture

```
supabase/migrations/
  0027_extension_lookups.sql
    create table extension_lookups (
      id uuid primary key default gen_random_uuid(),
      linkedin_url text not null,
      matched_user_id uuid references auth.users(id),
      created_at timestamptz not null default now()
    );
    -- RLS enabled, no policies (Decision 5)

lib/
  extensionLookups.ts
    recordLookup({ linkedinUrl, matchedUserId }): Promise<void>

  adminExtension.ts
    listRecentLookups(limit = 50): candidate email (via matched_user_id -> fitment_leads) or null, timestamp
    getLookupStats(): { totalLookups, matchedLookups, last30DaysLookups }

app/
  api/public/recruiter-preview/lookup/route.ts   # + recordLookup() call before both the 404 and success returns
  admin/
    extension/
      page.tsx     # stats line + recent-lookups table
    layout.tsx     # add "Extension" nav link
```

## Data flow

**`recordLookup`** — plain insert, fire-and-await (not fire-and-forget: a failed insert shouldn't silently vanish, but per the same reasoning as slice 6's view tracking, it must never block or fail the actual lookup response — wrap in `.catch()` and log, same pattern as `recordShareLinkView`).

**Lookup route wiring** — after the existing `settingsRow` fetch resolves (matched or `null`), call `recordLookup({ linkedinUrl: normalized, matchedUserId: settingsRow?.user_id ?? null })` once, then proceed to the existing 404-or-build-response logic unchanged. One log point covers both outcomes.

**`listRecentLookups`** — all rows ordered `created_at desc`, capped at `limit`; email resolved via `fitment_leads` keyed by `matched_user_id`, same `emailByUser` pattern as slices 4/5/6. Rows with `matched_user_id = null` show "No match."

**`getLookupStats`** — three counts: total rows, rows where `matched_user_id is not null`, rows where `created_at >= now() - 30 days`. Plain aggregate queries, no pure function needed.

## Error handling

- `recordLookup` failure → logged, swallowed, lookup response unaffected (matches Decision in slice 6's view tracking).
- Empty `extension_lookups` table → "No lookups yet."

## Explicitly out of scope

- Install/active counts (Decision 1).
- Per-recruiter attribution — impossible under the current single shared-key model; would require PM priority #1 (recruiter accounts / allowlist) first.
- Candidate-facing "N recruiters viewed your profile" feedback (PM priority #2) — this slice is admin oversight only, not the candidate feature that would consume the same underlying data later.
- Rate-limiting or abuse detection on the lookup endpoint — out of scope, this slice is visibility only.

## Testing

- No new pure-function TDD candidate: `recordLookup` is a thin insert wrapper, same category as slice 6's `recordShareLinkView`/`setShareLinkRevokedByToken`. `getLookupStats`/`listRecentLookups` are plain aggregate reads, same category as `listTransactions`/`listCounsellingRequests`.
- Page: manual verification against real data, matching slices 2-6 convention.
