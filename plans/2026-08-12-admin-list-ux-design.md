# Admin List UX (Search/Filter/Sort/Pagination/Export) — Design

**Status:** Approved design, not yet planned/implemented.

## Context

Second of three follow-up sub-projects from the 2026-08-12 admin portal audit (first: `plans/2026-08-12-admin-shell-design-system-design.md`, sub-project A). Candidates, Payments, and Extension-usage lists currently render every row unfiltered, unpaginated, unsorted — fine at today's volume (~14 candidates, 38 lookups) but already showing cracks (Extension page is ~30 near-useless "No match" rows with no way to hide them). `lib/adminCandidates.ts:listCandidates()` also does a full unbounded scan across `fitment_leads`/`report_unlocks`/`fitment_interviews`/`personality_tests`/`reference_checks` plus one external IntervueBox HTTP call per row — flagged separately in the backend audit as a perf risk. Server-side pagination here resolves that finding as a side effect, so it is not duplicated in sub-project C.

Depends on sub-project A's `Table` and `Pagination` components — implementation should sequence after A (or at minimum after those two components land).

## Decisions

1. **Server-side pagination/search/sort/filter**, driven by URL query params (`?q=&stage=&status=&sort=&page=`), not client-side fetch-all-then-filter. Row counts will grow past what's reasonable to ship in one response, and query-param-driven state makes filtered views linkable/shareable (e.g. "show me all `failed` payments" is a URL an admin can bookmark or paste in Slack).
2. **CSV export on Candidates and Payments only, not Extension.** The first two have a real ops/reporting use case (sharing a funnel snapshot, reconciling payments); extension-lookup data is internal-engineering-only with no such use case — skipping it keeps scope tight.
3. **Extension page gets a match-status filter** (`?matched=1`), defaulting to showing all rows same as today, so the ~30 "No match" rows can be hidden without losing the ability to see them.
4. **Page size fixed at 20**, no user-configurable page size — YAGNI at current volume, easy to bump later if needed.

## Architecture

```
lib/
  adminCandidates.ts     # listCandidates(params: { q?, stage?, sort?, page? }) — adds WHERE/ORDER/LIMIT/OFFSET, returns { rows, total }
  adminPayments.ts       # listTransactions(params: { status?, product?, sort?, page? }) — same shape
  adminExtension.ts      # listLookups(params: { matched?, page? }) — same shape
app/admin/
  candidates/page.tsx    # reads searchParams, renders search box + stage filter + Table + Pagination
  payments/page.tsx      # reads searchParams, renders status/product filter + Table + Pagination
  extension/page.tsx     # reads searchParams, renders matched-only toggle + Table + Pagination
  candidates/export/route.ts   # GET, streams CSV of the *filtered* result set (not just current page)
  payments/export/route.ts     # GET, same pattern
```

Filter/search/sort inputs are `<form>`-based (GET, no client JS state needed) submitting to the same page URL — matches this repo's existing zero-client-state-library convention (no React Query/SWR anywhere in the codebase) and keeps these as server components.

CSV export routes re-run the same `list*()` functions with the current filters but no page/limit (or a high hard cap, e.g. 5,000 rows, to avoid an unbounded export) and stream a `text/csv` response — reuses the exact same filter logic as the page, so exported data always matches what's on screen.

## Data flow

`list*()` functions change from "fetch everything, return array" to "fetch matching page, return `{ rows, total }`" — every call site (funnel overview does NOT call these, only the list pages do) gets updated to pass `{ rows, total }` into `<Table>` + `<Pagination total={total} page={page} pageSize={20} />`.

Search (`q`) on Candidates is `ILIKE` against `fitment_leads.email` and the resolved candidate name field — matches how the existing (unpaginated) query already joins those tables, no new join needed.

## Error handling

Invalid/out-of-range `page` query param (e.g. `page=999` past the last page, or `page=abc`) clamps to a valid page (1 or last) rather than erroring — a malformed URL shouldn't 500 an admin out of the page. CSV export hitting the 5,000-row cap includes a note in the response (e.g. a truncation flag in a response header) rather than silently dropping rows with no indication.

## Explicitly out of scope

- Audit trail, drill-down restructure, breadcrumbs, global cross-list search, funnel "last computed at" timestamp (remaining sub-project B pieces — separate specs).
- Counselling list — already has a working active/all-history toggle from its original slice, not part of this pass unless review finds it needs the same treatment (it currently has only 2 rows in production data; revisit if that changes).
- Backend hardening items (sub-project C) — unrelated to this pass except where explicitly noted above (the unbounded-scan perf finding, resolved as a side effect).
- User-configurable page size, saved filters/views.

## Testing

`list*()` functions gain new pure-logic surface area (query-param parsing/clamping, WHERE-clause construction) — these should get unit tests following the existing convention (`lib/__tests__/admin*.test.ts`, `vitest`), same pattern as `computeFunnelStage`/`findUnpaidUnlocks`/`nextCounsellingState`. CSV export routes and the page-level search/filter forms get manual browser verification (same checklist as sub-project A) rather than new component tests, consistent with this repo having no component-test setup.
