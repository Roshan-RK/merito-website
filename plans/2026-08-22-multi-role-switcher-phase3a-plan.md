# Multi-Role Switcher — Phase 3a: Internal Identity-Key Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** everywhere a `fitment_leads` row (with `.id`) is already resolved in scope — or can be resolved with no new external parameter — switch the `fitment_interviews` identity match from `role_title` text to `lead_id`. No route's external request/response shape changes in this sub-phase; no client-side file changes. This collapses "two independent fuzzy `role_title` text matches that can silently disagree" down to "one fuzzy match (for the lead), then exact" everywhere it's already cheap to do so.

**Architecture:** additive-safe query pattern, not a hard cutover. See Global Constraint below — this is the single most important rule in this plan.

**Tech Stack:** Next.js 16.2.4, Supabase/Postgres, Vitest.

## Global Constraints

- **THE CRITICAL SAFETY RULE — read this before touching any query.** Phase 1's `lead_id` backfill (`supabase/migrations/0049_fitment_interviews_lead_id.sql`) explicitly leaves `lead_id` as `NULL` on historical rows where no matching lead could be found (its own comment calls this "an acceptable, explainable outcome"). If this phase's queries switch to `.eq("lead_id", current.id)` outright, any interview row that never got backfilled becomes **permanently invisible** to a real candidate who completed it — a silent, undetectable regression (empty state, not an error). Every query changed in this plan MUST use Supabase's `.or()` filter to match on **either** key, never a bare `.eq("lead_id", ...)` replacement:
  ```typescript
  .or(`lead_id.eq.${leadId},role_title.eq.${roleTitle}`)
  ```
  (Supabase JS `.or()` takes a single comma-separated string of `column.operator.value` clauses — no additional `.eq()` chained after it for these two columns.) Keep the existing `.order("updated_at", { ascending: false }).limit(1)` (or equivalent) after the `.or()` exactly as before — it's still needed to pick one row when, e.g., an old role_title-only row and a new lead_id-tagged row both exist. This `.or()` pattern is the deliverable for every read-site task below; a task that ships a bare `lead_id` replacement is not spec-compliant, no matter how it reads otherwise.
- No route's request/response shape changes in this sub-phase. If a task's investigation reveals a query can only be improved by changing what a route accepts from outside, stop and report — that query belongs in sub-phase 3b, not this one.
- Test convention: Vitest, matching each file's existing mock style.
- Full design context: `plans/2026-08-21-multi-role-switcher-design.md` (see the 2026-08-22 addendum for how this sub-phase fits the larger combined Phase 3+5 effort).

---

### Task 1: Dashboard `page.tsx` — lead_id-aware interview lookup

**Files:**
- Modify: `app/hub/account/page.tsx`

**Interfaces:** none — self-contained, `current.id` (the active lead's id) is already resolved earlier in this same file via `resolveActiveLead`.

- [ ] **Step 1: Read the full file**, locate the `fitment_interviews` query that currently does `.eq("user_id", user.id).eq("role_title", current.role_title)`.

- [ ] **Step 2: Apply the safety-rule pattern**

Before:
```typescript
  const { data: interviewRow } = await supabase
    .from("fitment_interviews")
    .select("id, status, ib_agent_id, ib_candidate_id, invited_at, stuck_at")
    .eq("user_id", user.id)
    .eq("role_title", current.role_title)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```
After:
```typescript
  const { data: interviewRow } = await supabase
    .from("fitment_interviews")
    .select("id, status, ib_agent_id, ib_candidate_id, invited_at, stuck_at")
    .eq("user_id", user.id)
    .or(`lead_id.eq.${current.id},role_title.eq.${current.role_title}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`. This file has no dedicated test file — expected, not a gap.

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/page.tsx
git commit -m "feat(hub): dashboard interview lookup matches lead_id or role_title"
```

---

### Task 2: `share-summary/page.tsx` + `export/share-summary/route.tsx`

**Files:**
- Modify: `app/hub/account/share-summary/page.tsx`
- Modify: `app/api/hub/export/share-summary/route.tsx`
- Test: `app/api/hub/export/share-summary/__tests__/route.test.ts` (exists)

**Interfaces:** both files already have a `currentLead` variable in scope (a `fitment_leads` row) at the point of the `fitment_interviews` query — confirm this by reading each file in full; `currentLead.id` is what you need.

- [ ] **Step 1: Read both files in full.**

- [ ] **Step 2: Apply the safety-rule pattern to each.**

`app/hub/account/share-summary/page.tsx`, before:
```typescript
  let query = supabase.from("fitment_interviews").select("status, updated_at").eq("user_id", user.id);
  if (currentLead) query = query.eq("role_title", currentLead.role_title);
  const { data: row } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
```
After:
```typescript
  let query = supabase.from("fitment_interviews").select("status, updated_at").eq("user_id", user.id);
  if (currentLead) query = query.or(`lead_id.eq.${currentLead.id},role_title.eq.${currentLead.role_title}`);
  const { data: row } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
```

`app/api/hub/export/share-summary/route.tsx`, before:
```typescript
  let query = supabase.from("fitment_interviews").select("status").eq("user_id", user.id);
  if (currentLead) query = query.eq("role_title", currentLead.role_title);
  const { data: interview } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
```
After (same transformation):
```typescript
  let query = supabase.from("fitment_interviews").select("status").eq("user_id", user.id);
  if (currentLead) query = query.or(`lead_id.eq.${currentLead.id},role_title.eq.${currentLead.role_title}`);
  const { data: interview } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
```

Confirm in each file whether `currentLead`'s select already includes `id` — if not, add `id` to that select (a zero-new-external-surface change, purely additive to an existing internal query).

- [ ] **Step 3: Update the existing test**

In `app/api/hub/export/share-summary/__tests__/route.test.ts`, find the mock/assertion for the `fitment_interviews` query chain and update it to expect `.or(...)` instead of `.eq("role_title", ...)`, matching the file's existing mock style. `app/hub/account/share-summary/page.tsx` has no test file — expected.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`.

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/share-summary/page.tsx app/api/hub/export/share-summary/route.tsx app/api/hub/export/share-summary/__tests__/route.test.ts
git commit -m "feat(hub): share-summary interview lookups match lead_id or role_title"
```

---

### Task 3: `recruiter-preview/page.tsx` + `recruiter-preview/lookup/route.ts`

**Files:**
- Modify: `app/hub/account/recruiter-preview/page.tsx`
- Modify: `app/api/public/recruiter-preview/lookup/route.ts`
- Test: `app/api/public/recruiter-preview/lookup/__tests__/route.test.ts` (exists)

**Interfaces:** both files resolve a `fitment_leads` row (`currentLead`/via a `leads` select ordered by `created_at`) before the `fitment_interviews` query — confirm the resolved row's `.id` is selected; add it to the select if missing (see Task 2's note on this).

- [ ] **Step 1: Read both files in full.**

- [ ] **Step 2: Apply the safety-rule pattern to each.**

`app/hub/account/recruiter-preview/page.tsx`, before:
```typescript
  const { data: interviewRow } = await supabase
    .from("fitment_interviews")
    .select("status, report_raw, updated_at")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```
After (using whatever variable holds the resolved lead's id — read the file to find its exact name, likely `currentLead.id`):
```typescript
  const { data: interviewRow } = await supabase
    .from("fitment_interviews")
    .select("status, report_raw, updated_at")
    .eq("user_id", user.id)
    .or(`lead_id.eq.${currentLead.id},role_title.eq.${roleTitle}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```

`app/api/public/recruiter-preview/lookup/route.ts`, before:
```typescript
  const { data: interviewRow } = await admin
    .from("fitment_interviews")
    .select("status, report_raw, updated_at")
    .eq("user_id", userId)
    .eq("role_title", roleTitle)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```
After: same transformation — the file already selects the current lead's `id` or can trivially add it to its existing `fitment_leads` select (which currently pulls `role_title, name, resume_match_status, resume_match_raw, candidate_level` — add `id`).

- [ ] **Step 3: Update the existing test**

`app/api/public/recruiter-preview/lookup/__tests__/route.test.ts` — update the `fitment_interviews` mock/assertion to the `.or(...)` shape. `recruiter-preview/page.tsx` has no test file — expected.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`.

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/recruiter-preview/page.tsx app/api/public/recruiter-preview/lookup/route.ts app/api/public/recruiter-preview/lookup/__tests__/route.test.ts
git commit -m "feat(hub): recruiter-preview interview lookups match lead_id or role_title"
```

---

### Task 4: `export/combined/route.tsx` + `lib/combinedReportData.ts`

**Files:**
- Modify: `app/api/hub/export/combined/route.tsx`
- Modify: `lib/combinedReportData.ts`
- Test: `app/api/hub/export/combined/__tests__/route.test.ts` (exists)

**Interfaces:** `app/api/hub/export/combined/route.tsx` ALSO uses `roleTitle` at a separate line to build a `?role=` URL param forwarded to `/hub/account/combined-report/print` — that use is NOT an identity match and MUST NOT change. Read the file in full and distinguish the two uses before editing.

- [ ] **Step 1: Read both files in full**, identifying every use of `roleTitle`/`currentLead` in each — which are the `fitment_interviews` identity match (to change) and which are display/URL-building (leave alone).

- [ ] **Step 2: Apply the safety-rule pattern only to the identity-match query(ies)** in each file — same `.or(\`lead_id.eq.${leadId},role_title.eq.${roleTitle}\`)` transformation as prior tasks. Leave the `?role=` URL-building line in `export/combined/route.tsx` completely untouched.

If either file doesn't yet have a resolved lead's `.id` in scope at the point of the `fitment_interviews` query, add `id` to whatever `fitment_leads` select already runs in that function — do not add a brand-new query if an existing one can just select one more column.

- [ ] **Step 3: Update the existing test**

`app/api/hub/export/combined/__tests__/route.test.ts` — update the `fitment_interviews` mock/assertion. `lib/combinedReportData.ts` has no dedicated test file — expected.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`.

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/export/combined/route.tsx lib/combinedReportData.ts app/api/hub/export/combined/__tests__/route.test.ts
git commit -m "feat(hub): combined-export interview lookup matches lead_id or role_title"
```

---

### Task 5: `interview/page.tsx` — lead_id-aware reverse lookups + stale comment

**Files:**
- Modify: `app/hub/account/interview/page.tsx`

**Interfaces:** this page's PRIMARY `fitment_interviews` query (keyed by its own `?role=` search param, `scopedToRole`) is OUT OF SCOPE for this task — that's sub-phase 3b's job, since changing it means changing this page's own external URL contract. This task only touches the TWO SEPARATE reverse-lookups back to `fitment_leads` that happen AFTER the interview row is already fetched.

- [ ] **Step 1: Read the full file.** Locate:
  - The primary interview query (~line 58-68) — leave completely untouched.
  - The comment at ~lines 70-76 claiming *"fitment_interviews is matched by free-text role_title with no lead_id"* — this is stale (lead_id has existed since Phase 1). Update or remove it to reflect current reality; do not leave a comment asserting something false.
  - The reverse-lookup at ~lines 123-130 (`fitment_leads` by `.eq("role_title", interview.role_title)`, for `candidate_level`).
  - The reverse-lookup at ~lines 179-186 (`fitment_leads` by `.eq("role_title", interview.role_title)`, for `name`/`ib_applied_job_id`).

- [ ] **Step 2: Check whether the interview row selected at the primary query includes `lead_id`.** If not, add `lead_id` to that query's `.select(...)` list (purely additive — no external contract change, the route/page's own input param is untouched).

- [ ] **Step 3: Apply the safety-rule pattern to both reverse-lookups.**

Before (both, same shape):
```typescript
  const { data: leadForLevel } = await supabase
    .from("fitment_leads")
    .select("candidate_level")
    .eq("user_id", userId)
    .eq("role_title", interview.role_title)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```
After:
```typescript
  const { data: leadForLevel } = await supabase
    .from("fitment_leads")
    .select("candidate_level")
    .eq("user_id", userId)
    .or(`id.eq.${interview.lead_id ?? ""},role_title.eq.${interview.role_title}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```
(Note the direction is reversed from prior tasks — here you're matching `fitment_leads.id` against the interview's `lead_id`, not the other way around. If `interview.lead_id` is `null`, the `id.eq.` clause matches nothing and the `role_title.eq.` clause carries the query exactly as it did before this change — safe by construction. Apply the equivalent transformation to the second reverse-lookup at ~line 179-186.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`. No dedicated test file for `page.tsx` itself — expected (sibling component tests exist and are unaffected).

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/interview/page.tsx
git commit -m "feat(hub): interview page reverse-lookups match lead_id or role_title"
```

---

### Task 6: `interview/print/page.tsx` — lead_id-aware reverse lookup

**Files:**
- Modify: `app/hub/account/interview/print/page.tsx`

**Interfaces:** same rule as Task 5 — the primary `fitment_interviews` query (keyed by its own `?role=` param) is 3b's job; only the reverse-lookup to `fitment_leads` changes here.

- [ ] **Step 1: Read the full file.** Locate the primary query (~line 114-123, leave untouched) and the reverse-lookup (~line 131-138).

- [ ] **Step 2: Check whether the primary query's select includes `lead_id`** — add it if missing, same as Task 5 Step 2.

- [ ] **Step 3: Apply the same reversed safety-rule pattern as Task 5 Step 3** to the reverse-lookup:
```typescript
  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("name, ib_applied_job_id")
    .eq("user_id", user.id)
    .or(`id.eq.${interview.lead_id ?? ""},role_title.eq.${interview.role_title}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`. No dedicated test file — expected.

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/interview/print/page.tsx
git commit -m "feat(hub): interview print page reverse-lookup matches lead_id or role_title"
```

---

### Task 7: `lib/adminAnalytics.ts` — lead-id-keyed join

**Files:**
- Modify: `lib/adminAnalytics.ts`
- Test: `lib/__tests__/adminAnalytics.test.ts` (exists)

**Interfaces:** this file does an in-memory (not SQL) join between `fitment_leads` and `fitment_interviews` inside `getScoreAnalysis()`, currently keyed by the string `` `${user_id}:${role_title}` ``. This is a genuine identity-matching use with the same collision risk as every SQL-level site in this plan — fix it the same way, just in application code instead of a query filter.

- [ ] **Step 1: Read the full function** (`getScoreAnalysis`, around lines 250-270) to see both sides of the join: the `fitment_leads` rows being keyed, and the `fitment_interviews` rows being looked up.

- [ ] **Step 2: Switch the join key from `` `${user_id}:${role_title}` `` to `` `${user_id}:${lead_id ?? role_title}` `` on BOTH sides of the join** — i.e., when building the map, use the interview's `lead_id` if present (falling back to `role_title` when it's `null`, so historical unbackfilled rows still match); when looking up, use the lead's own `id` if the interview being matched against has a non-null `lead_id` — concretely: build the map keyed by `` `${row.user_id}:${row.lead_id ?? row.role_title}` `` from the `fitment_interviews` side, then look it up via `` `${lead.user_id}:${lead.id}` `` **and** as a fallback `` `${lead.user_id}:${lead.role_title}` `` if the first lookup misses. If the exact shape of this dual-lookup isn't obvious once you're reading the real code, that's fine — describe the two-key fallback requirement in your own words in the implementation and explain your approach in the report; the goal is: an interview with a real `lead_id` matches its lead by id; an interview with `lead_id = null` still matches by `role_title` exactly as it did before this change.
Make sure the `fitment_interviews` select at the top of the function also pulls `lead_id` (add it if missing).

- [ ] **Step 3: Update the existing test**

`lib/__tests__/adminAnalytics.test.ts` — update fixtures/assertions to reflect the new join key, matching the file's existing mock style. Add a test case (or extend an existing one) for a row with `lead_id = null` still matching via `role_title`, since that fallback path is the crux of this task's safety requirement.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`.

- [ ] **Step 5: Commit**

```bash
git add lib/adminAnalytics.ts lib/__tests__/adminAnalytics.test.ts
git commit -m "feat(admin): score-analysis join prefers lead_id, falls back to role_title"
```

---

### Task 8: `lib/adminCandidates.ts` — lead-id-keyed join

**Files:**
- Modify: `lib/adminCandidates.ts`
- Test: `lib/__tests__/adminCandidates.test.ts` (exists)

**Interfaces:** same pattern as Task 7, different function. `latestInterviewByRole`/`interviewByRole` maps (around lines 307-323) are keyed by `role_title` string; the actual lookup happens per-lead inside the `leads.map(async (lead) => {...})` block (around lines 377-415) via `latestInterviewByRole.get(lead.role_title)` / `interviewByRole.get(lead.role_title)`.

- [ ] **Step 1: Read the full surrounding context** (roughly lines 300-420) to see the map-building and both lookup call sites.

- [ ] **Step 2: Apply the same dual-key fallback approach as Task 7** — key the maps so an interview row with a non-null `lead_id` is matched against `lead.id`, and a row with `lead_id = null` still matches via `lead.role_title` exactly as before. Make sure the `fitment_interviews` select feeding these maps includes `lead_id` (add it if missing — it likely already selects `id, role_title, status, report_raw, ...`, just add `lead_id` to that list).

- [ ] **Step 3: Update the existing test**

`lib/__tests__/adminCandidates.test.ts` — update fixtures/assertions, matching existing style. Add a case for the `lead_id = null` fallback path.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`.

- [ ] **Step 5: Commit**

```bash
git add lib/adminCandidates.ts lib/__tests__/adminCandidates.test.ts
git commit -m "feat(admin): candidate-detail interview join prefers lead_id, falls back to role_title"
```

---

### Task 9: `start-ai-interview/route.ts` — wire real `lead.id` into pipeline-failure recording + fix stale comment

**Files:**
- Modify: `app/api/hub/start-ai-interview/route.ts`
- Test: `app/api/hub/start-ai-interview/__tests__/route.test.ts` (exists)

**Interfaces:** this task does NOT touch this route's `existing`/`priorAttempt` role_title-matching logic (lines ~36-42, ~64-71, ~208-214) — those stay exactly as they are; changing them is sub-phase 3b's job since it's this route's own external contract (`roleTitle` in the request body). This task only fixes the pipeline-failure recording, which already has `lead.id` available in scope and simply isn't using it.

- [ ] **Step 1: Read the full file.** Confirm: `lead` (the `fitment_leads` row, with `.id`) is resolved at ~line 110-117, BEFORE the `try`/`catch` block whose failure paths call `recordFailedInviteAttempt`/`recordPipelineFailure` (the local helper defined ~line 142, and the direct call in the insert-error branch ~line 228). Every one of those calls currently passes `leadId: null` — change each to `leadId: lead.id`.

- [ ] **Step 2: Fix the stale comment** at ~lines 60-63, which currently claims *"role_title is the only link fitment_interviews has back to an attempt (no lead_id FK)"* — this has been false since Phase 1 (migration `0049_fitment_interviews_lead_id.sql`). Update it to reflect current reality, or remove it if it's no longer needed to explain the surrounding code.

- [ ] **Step 3: Update the existing test**

`app/api/hub/start-ai-interview/__tests__/route.test.ts` — find the assertions on `recordPipelineFailure`/`recordFailedInviteAttempt` calls and update the expected `leadId` from `null` to the test fixture's lead id value, matching the file's existing mock style.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`.

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/start-ai-interview/route.ts app/api/hub/start-ai-interview/__tests__/route.test.ts
git commit -m "feat(hub): start-ai-interview records real lead_id on pipeline failures"
```

---

### Task 10: `merge_candidate_accounts` SQL — lead-id-aware `fitment_interviews` guard

**Files:**
- Create: `supabase/migrations/00NN_merge_candidate_accounts_fitment_interviews_lead_id.sql` (verify the real next number yourself — do not trust any number written here; list `supabase/migrations/` first)

**Interfaces:** mirrors the exact pattern already used in `supabase/migrations/0054_merge_candidate_accounts_personality_tests_pk_fix.sql` from the prior phase — read that file first as your template for how this repo does an append-only `create or replace function` fix.

- [ ] **Step 1: List migrations to get the real next number.**

Run: `ls supabase/migrations/ | sort -t_ -k1 -n | tail -5`

- [ ] **Step 2: Read `supabase/migrations/0034_admin_account_management.sql` AND `supabase/migrations/0054_merge_candidate_accounts_personality_tests_pk_fix.sql` in full.** The current `fitment_interviews` clause (reproduced verbatim in 0054, since 0054 already replaced the whole function once) is:
```sql
  update fitment_interviews t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not exists (select 1 from fitment_interviews k where k.user_id = keep_user_id and k.role_title = t.role_title);
  get diagnostics n_fitment_interviews = row_count;
```
Unlike Phase 2's `personality_tests` fix, `fitment_interviews` does NOT have a unique constraint on `lead_id` (confirmed: `fitment_interviews_lead_id_idx` is a plain non-unique btree) and multiple interview rows CAN legitimately share a `user_id` (one per role, ever). So this clause is not actually broken by a PK change the way Phase 2's was — `role_title` remains a valid uniqueness-avoidance check here since `fitment_interviews` was never re-keyed to `lead_id` as its identity in this sub-phase. **Do not blindly copy Phase 2's fix pattern.** Instead: change the guard so it treats two interview rows as "the same interview" (and thus skips the move to avoid a duplicate) when they share EITHER `lead_id` OR `role_title` — matching this plan's `.or()` safety rule, translated into SQL:
```sql
  update fitment_interviews t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not exists (
        select 1 from fitment_interviews k
        where k.user_id = keep_user_id
          and (
            (t.lead_id is not null and k.lead_id = t.lead_id)
            or k.role_title = t.role_title
          )
      );
  get diagnostics n_fitment_interviews = row_count;
```
Reproduce the ENTIRE function body from `0054` verbatim in the new migration, with ONLY this `fitment_interviews` clause changed. Every other clause (`fitment_leads`, `report_unlocks`, `personality_tests`, `reference_checks`, `report_share_links`, `contact_detail_requests`, `recruiter_preview_settings`) must be byte-identical to `0054`'s version.

- [ ] **Step 3: Trace the new guard by hand** for these cases, writing your reasoning in the report: (a) `t` has a non-null `lead_id` and `k` shares it → skip (correct, same interview already exists on keep_user_id); (b) `t.lead_id` is null but `t.role_title` matches some `k.role_title` → skip (same as pre-existing behavior); (c) `t.lead_id` is null and no `k.role_title` matches → move proceeds (correct, no duplicate exists).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00NN_merge_candidate_accounts_fitment_interviews_lead_id.sql
git commit -m "feat(db): merge_candidate_accounts fitment_interviews guard checks lead_id or role_title"
```

(Replace `00NN` with the actual filename used.)

---

## Phase 3a exit criteria

- `npm test` passes in full.
- `npm run build` succeeds.
- No query in this plan's scope was changed to a bare `.eq("lead_id", ...)` — every one uses the `.or()` (or, for the two reversed-direction lookups and the two in-memory joins, the equivalent null-safe fallback) safety pattern, verified in the final review.
- No route's external request/response contract changed. No client-side (`"use client"`) file was touched.
- Sub-phases 3b (external API/client cutover) and 3c (real switcher UI) are untouched — each gets its own plan written immediately before it's picked up.
