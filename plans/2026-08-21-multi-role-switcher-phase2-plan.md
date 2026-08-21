# Multi-Role Switcher — Phase 2: Personality Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** make `personality_tests` candidate-level (keyed by `user_id` alone) instead of per-role (`user_id, role_title`), per the locked design decision — personality is a trait of the person, taken once, reused across every JD. This removes the last per-role coupling on a table that was never supposed to be per-role in the first place.

**Architecture:** Unlike Phase 1 (purely additive), this phase changes a primary key and deletes duplicate historical rows — already user-approved (see `plans/2026-08-21-multi-role-switcher-design.md`, decision #2: "existing duplicate rows deduped, keep newest `completed_at`"). Schema change and every call site reading/writing by `role_title` ship in the same phase, per the `report_unlocks` lesson: shipping schema ahead of every write-path code change breaks prod.

**Tech Stack:** Next.js 16.2.4, Supabase/Postgres, Vitest.

## Global Constraints

- Migrations use `add column if not exists` / idempotent style where applicable (repo convention, `supabase/migrations/0047_fitment_leads_override_lock.sql`); the PK change here is not additive and cannot use that idiom — write it as plain DDL, but make the dedup DELETE safe to re-run (it naturally is: once only one row per `user_id` remains, the DELETE matches zero rows on a second run).
- **Verify the actual next migration number before creating the file.** `main` has other work landing concurrently (last checked: latest existing file was `0052_fitment_interviews_override_lock.sql`, but do not trust that number by the time this phase executes — list the directory yourself). This exact mistake happened in Phase 1 and was correctly self-corrected there; do the verification up front this time instead.
- Test convention: Vitest, mock `@/lib/supabase`'s `getSupabaseServerClient` (or `supabaseAuthServer`'s `createSupabaseServerClient`, whichever the file under test already uses) via `vi.mock`, chained per-call mocks matching each file's own existing test style — do not introduce a second mocking style in a file that already has tests.
- `personality_tests.role_title` stays as a column (still `not null`) — this phase does not drop it or stop writing it. Only its role as part of the identity/matching key changes. Do not remove the column or make it nullable.
- Every read call site's `.eq("role_title", ...)` filter must be removed as part of this phase — a query that still filters on `role_title` after the PK change will silently return the row only when the candidate's *currently viewed* role happens to match whatever role was live at the last personality-test save, which is exactly the bug this phase exists to fix.
- No behavior change to the actual personality scoring, validity computation, or the test-taking UI itself — this phase only changes how the saved result is looked up and matched.

## Call sites inventory (verified 2026-08-21 against current code)

**Write (1 site):**
- `app/api/hub/save-personality-test/route.ts:63-73` — `upsert(..., { onConflict: "user_id,role_title" })`

**Read (10 sites, all currently `.eq("user_id", X).eq("role_title", roleTitle)` or equivalent):**
- `app/hub/account/personality/page.tsx:69-72`
- `app/hub/account/personality/print/page.tsx:83-86`
- `app/hub/account/share-summary/page.tsx:52-56`
- `app/hub/account/page.tsx:186-190` (dashboard's personality-done badge — selects `role_title` only, no scores)
- `app/hub/account/recruiter-preview/page.tsx:38-42`
- `app/api/hub/export/combined/route.tsx:43-47`
- `app/api/hub/export/share-summary/route.tsx:41-45`
- `app/api/hub/personality/export/route.tsx:34-38`
- `app/api/public/recruiter-preview/lookup/route.ts:88-92`
- `lib/combinedReportData.ts:64-70`
- `lib/adminCandidates.ts:324-328` (admin candidate detail view)

**No change needed:** `lib/adminCandidates.ts:75` (`fetchAllCandidates`'s funnel-stage query selects only `user_id`, no role filter — already candidate-level, unaffected).

---

### Task 1: Migration — dedupe rows and change PK to `user_id`

**Files:**
- Create: `supabase/migrations/00NN_personality_tests_user_pk.sql` (replace `00NN` with the real next number — see Global Constraints)

**Interfaces:**
- Produces: `personality_tests` primary key becomes `(user_id)`; at most one row per user survives.

- [ ] **Step 1: List the migrations directory to get the real next number**

Run: `ls supabase/migrations/ | sort -t_ -k1 -n | tail -5`
Use the highest number + 1. Do not reuse a number already present (there was already one collision in this repo's history at `0049` — two different files both claimed it — don't add a third).

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/00NN_personality_tests_user_pk.sql

-- Personality is candidate-level, not per-role (locked decision, see
-- plans/2026-08-21-multi-role-switcher-design.md). Keep only the newest row
-- per user_id -- ties on completed_at broken by role_title for a
-- deterministic result. User-approved: older duplicate per-role answers are
-- lost, not archived.
delete from personality_tests pt
where exists (
  select 1
  from personality_tests newer
  where newer.user_id = pt.user_id
    and (newer.completed_at, newer.role_title) > (pt.completed_at, pt.role_title)
);

alter table personality_tests drop constraint personality_tests_pkey;
alter table personality_tests add primary key (user_id);
```

- [ ] **Step 3: Verify the dedup logic before committing**

This DELETE is a correctness-critical set operation — trace it by hand: for a `user_id` with rows `(completed_at=T1, role_title='A')` and `(completed_at=T2, role_title='B')` where `T2 > T1`, the `T1` row has a "newer" counterpart (`T2 > T1`) so it's deleted; the `T2` row has no row with a strictly greater tuple, so it survives. Confirm this reasoning holds, and confirm that after the DELETE, `select user_id, count(*) from personality_tests group by user_id having count(*) > 1` would return zero rows (you cannot run this against a live DB in this session — state the reasoning in your report instead of attempting to run it).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00NN_personality_tests_user_pk.sql
git commit -m "feat(db): dedupe personality_tests and change PK to user_id alone"
```

(Replace `00NN` in the commit with the actual filename used.)

---

### Task 2: Write path — `save-personality-test` upsert target

**Files:**
- Modify: `app/api/hub/save-personality-test/route.ts:63-73`
- Test: `app/api/hub/save-personality-test/__tests__/route.test.ts` if it exists (check first; if it doesn't exist, this task has no test file to extend — say so in your report rather than creating a new test file, since that would be scope beyond this task)

**Interfaces:**
- Consumes: nothing from Task 1 directly (Task 1 is a pure schema change; this task's code change is independent and can be reviewed on its own, but must land in the same phase per the Global Constraints ordering-of-deploy rule).

- [ ] **Step 1: Read the full route file**

Read `app/api/hub/save-personality-test/route.ts` in full (already quoted above, but confirm nothing else in the file references `role_title` beyond what's shown).

- [ ] **Step 2: Change the upsert's conflict target**

Change:

```typescript
  const { error: upsertError } = await admin.from("personality_tests").upsert(
    {
      user_id: user.id,
      role_title: roleTitle,
      scores,
      validity,
      answers,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,role_title" }
  );
```

to:

```typescript
  const { error: upsertError } = await admin.from("personality_tests").upsert(
    {
      user_id: user.id,
      role_title: roleTitle,
      scores,
      validity,
      answers,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
```

`role_title` stays in the row itself (still `not null` on the column, per Global Constraints) — only the conflict target changes, from the old composite key to the new single-column PK.

- [ ] **Step 3: Update or write the test**

If `app/api/hub/save-personality-test/__tests__/route.test.ts` exists, update its assertion of the upsert call's second argument from `{ onConflict: "user_id,role_title" }` to `{ onConflict: "user_id" }`, matching the file's existing mock style. If no test file exists for this route, do not create one — note that in your report.

- [ ] **Step 4: Run the test and the full suite**

Run: `npx vitest run app/api/hub/save-personality-test` (if a test file exists) then `npm test`
Expected: all green, no regressions.

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/save-personality-test/route.ts
git commit -m "feat(hub): personality upsert conflicts on user_id alone"
```

(Include the test file in the `git add` if one was updated.)

---

### Task 3: Read sites — candidate-facing hub pages

**Files:**
- Modify: `app/hub/account/personality/page.tsx:69-72`
- Modify: `app/hub/account/personality/print/page.tsx:83-86`
- Modify: `app/hub/account/share-summary/page.tsx:52-56`
- Modify: `app/hub/account/page.tsx:186-190`

**Interfaces:**
- Consumes: nothing from Tasks 1-2 directly; independently reviewable.

- [ ] **Step 1: Read each file's relevant section in full context**

For each of the 4 files, read enough surrounding code (not just the line range given) to see: (a) the exact current query chain, (b) whatever guard condition wraps it (e.g. `if (include.has("personality") && roleTitle)`), and (c) what variable the result is assigned to and how it's used afterward.

- [ ] **Step 2: Apply this transformation to each of the 4 files**

The general shape in every file is:

```typescript
  const { data: existing } = await supabase
    .from("personality_tests")
    .select("scores, validity")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .maybeSingle();
```

Remove the `.eq("role_title", roleTitle)` line — the query becomes:

```typescript
  const { data: existing } = await supabase
    .from("personality_tests")
    .select("scores, validity")
    .eq("user_id", user.id)
    .maybeSingle();
```

(`app/hub/account/page.tsx:186-190` selects `role_title` only, not `scores, validity` — apply the same removal of the `.eq("role_title", ...)` filter line, keep its own `.select(...)` unchanged.)

**Also check the guard condition wrapping each query** (e.g. `if (include.has("personality") && roleTitle)` in the export-adjacent files, or whatever each of these 4 files uses). If the guard requires `roleTitle` to be truthy purely so the *old* query had something to filter on, that requirement is no longer correct — personality should be reachable regardless of which role is currently being viewed. Change such a guard to drop the `roleTitle` truthiness check (keep any other real precondition in the guard, e.g. `include.has("personality")` alone). If a file's guard doesn't mention `roleTitle` at all, leave it untouched. If you're unsure whether a given guard's `roleTitle` check is load-bearing for some other reason, stop and report NEEDS_CONTEXT rather than guessing — don't silently leave a stale guard in place either.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all green. None of these 4 files are expected to have dedicated test files (this is a Next.js server-component-heavy area) — if you find one, extend it the same way as Task 2's test update; if not, that's expected.

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/personality/page.tsx app/hub/account/personality/print/page.tsx app/hub/account/share-summary/page.tsx app/hub/account/page.tsx
git commit -m "feat(hub): drop role_title filter on personality_tests reads (candidate pages)"
```

---

### Task 4: Read sites — export/report routes

**Files:**
- Modify: `app/api/hub/export/combined/route.tsx:43-47`
- Modify: `app/api/hub/export/share-summary/route.tsx:41-45`
- Modify: `app/api/hub/personality/export/route.tsx:34-38`
- Modify: `lib/combinedReportData.ts:64-70`
- Test: `app/api/hub/export/combined/__tests__/route.test.ts`, `app/api/hub/export/share-summary/__tests__/route.test.ts`, `app/api/hub/personality/export/__tests__/route.test.ts` — all three already exist per the call-site inventory and mock `personality_tests` by table name; update each to match

**Interfaces:**
- Consumes: nothing from Tasks 1-3 directly; independently reviewable.

- [ ] **Step 1: Read each of the 4 source files' relevant section in full context**

Same as Task 3 Step 1 — read enough surrounding code to see the exact query, its guard condition, and how the result is used.

- [ ] **Step 2: Apply the same transformation as Task 3 Step 2** to all 4 files: remove `.eq("role_title", roleTitle)` (or the equivalent second `.eq` in `lib/combinedReportData.ts:64-70`, which may be written across two lines — read the actual current lines, they were only shown with 3 lines of context earlier in this plan's research and might wrap differently), and correct any guard condition that required `roleTitle` truthiness purely to gate the old query.

- [ ] **Step 3: Update the 3 existing test files**

For each of `app/api/hub/export/combined/__tests__/route.test.ts`, `app/api/hub/export/share-summary/__tests__/route.test.ts`, `app/api/hub/personality/export/__tests__/route.test.ts`: find the mock for the `personality_tests` table's query chain and remove the `role_title` filter expectation/mock step if the test asserts the exact chain of `.eq()` calls. Match each file's existing mock style — read it first, don't guess its shape.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/export/combined/route.tsx app/api/hub/export/share-summary/route.tsx app/api/hub/personality/export/route.tsx lib/combinedReportData.ts app/api/hub/export/combined/__tests__/route.test.ts app/api/hub/export/share-summary/__tests__/route.test.ts app/api/hub/personality/export/__tests__/route.test.ts
git commit -m "feat(hub): drop role_title filter on personality_tests reads (export routes)"
```

---

### Task 5: Read sites — recruiter-preview + admin

**Files:**
- Modify: `app/hub/account/recruiter-preview/page.tsx:38-42`
- Modify: `app/api/public/recruiter-preview/lookup/route.ts:88-92`
- Modify: `lib/adminCandidates.ts:324-328`
- Test: `app/api/public/recruiter-preview/lookup/__tests__/route.test.ts` (exists per the call-site inventory), `lib/__tests__/adminCandidates.test.ts` (exists per the call-site inventory)

**Interfaces:**
- Consumes: nothing from Tasks 1-4 directly; independently reviewable.

- [ ] **Step 1: Read each of the 3 source files' relevant section in full context**

Same approach as Tasks 3-4.

- [ ] **Step 2: Apply the same transformation as Task 3 Step 2** to all 3 files.

Note for `lib/adminCandidates.ts:324-328`: the current select is `select("role_title, scores, validity")` — this is the admin's per-candidate detail view. Keep `role_title` in the select list (it's still a real column, might still be shown in the admin UI as "role at time of test" informational context) — only remove the `.eq("role_title", ...)` **filter**, not the selected column. Read the function this query lives in (and its caller) to confirm whether `role_title` is actually rendered anywhere in the admin UI before deciding whether keeping it in the select is dead weight — if it turns out unused after the filter removal, note that as a concern in your report rather than unilaterally dropping the column from the select.

- [ ] **Step 3: Update the 2 existing test files**

Match each file's existing mock style, same as Task 4 Step 3.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/recruiter-preview/page.tsx app/api/public/recruiter-preview/lookup/route.ts lib/adminCandidates.ts app/api/public/recruiter-preview/lookup/__tests__/route.test.ts lib/__tests__/adminCandidates.test.ts
git commit -m "feat(hub): drop role_title filter on personality_tests reads (recruiter-preview + admin)"
```

---

## Phase 2 exit criteria

- `npm test` passes in full.
- `npm run build` succeeds.
- No remaining `.eq("role_title", ...)` filter on any `personality_tests` query anywhere in the codebase (grep for `personality_tests` and manually confirm each of the ~12 call sites from the inventory above).
- `personality_tests` table has at most one row per `user_id` (verified by migration reasoning in Task 1, since no live DB is reachable in-session).
- Phase 3 (interview cutover) and later phases are untouched — this phase does not touch `fitment_interviews`, `recruiter_preview_settings`, or the `?lead=` UI wiring.
