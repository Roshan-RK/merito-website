# Multi-Role Switcher — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** lay the additive, zero-risk foundation for the multi-role switcher — a reusable active-lead resolver, a `lead_id` column on `fitment_interviews` (dual-written + backfilled), and one real opt-in `?lead=` read path on the dashboard — without changing any existing user-visible behavior.

**Architecture:** All changes are additive. Nothing that currently works is removed or repointed in this phase. `role_title` stays the system of record for `fitment_interviews` lookups until Phase 3's cutover; this phase only starts writing `lead_id` alongside it and proves the resolver works on one read path.

**Tech Stack:** Next.js 16.2.4 (App Router, async `searchParams`), Supabase/Postgres, Vitest.

## Global Constraints

- Every migration in this repo uses `add column if not exists` for additive changes (see `supabase/migrations/0047_fitment_leads_override_lock.sql`) — match that style.
- Test convention: Vitest, mock `@/lib/supabase`'s `getSupabaseServerClient` via `vi.mock`, chain mocks per call (`.from().select().eq().maybeSingle()` etc.) matching `lib/__tests__/reportUnlocks.test.ts`.
- No behavior change for any user who never passes `?lead=` — this is the acceptance bar for every task below.
- Full design context and cross-surface impact map: `plans/2026-08-21-multi-role-switcher-design.md`. Read it before starting if anything below is unclear on *why*.

---

### Task 1: Central active-lead resolver

**Files:**
- Create: `lib/activeLead.ts`
- Test: `lib/__tests__/activeLead.test.ts`

**Interfaces:**
- Produces: `resolveActiveLead<T extends { id: string }>(leads: T[], requestedLeadId?: string | null): T | null` — pure function, no I/O. Returns the lead in `leads` whose `id === requestedLeadId` if found; otherwise returns `leads[0]`; returns `null` if `leads` is empty. Later phases (2-5) will import this into every page/route that currently does its own `leads[0]` pick.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/__tests__/activeLead.test.ts
import { describe, it, expect } from "vitest";
import { resolveActiveLead } from "../activeLead";

type FakeLead = { id: string; role_title: string };

const leads: FakeLead[] = [
  { id: "lead-2", role_title: "Senior Backend Engineer" },
  { id: "lead-1", role_title: "Backend Engineer" },
];

describe("resolveActiveLead", () => {
  it("returns the lead matching requestedLeadId when present", () => {
    expect(resolveActiveLead(leads, "lead-1")).toEqual(leads[1]);
  });

  it("returns leads[0] when requestedLeadId is undefined", () => {
    expect(resolveActiveLead(leads, undefined)).toEqual(leads[0]);
  });

  it("returns leads[0] when requestedLeadId is null", () => {
    expect(resolveActiveLead(leads, null)).toEqual(leads[0]);
  });

  it("returns leads[0] when requestedLeadId does not match any lead", () => {
    expect(resolveActiveLead(leads, "lead-does-not-exist")).toEqual(leads[0]);
  });

  it("returns null when leads is empty", () => {
    expect(resolveActiveLead([], "lead-1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/activeLead.test.ts`
Expected: FAIL — `Cannot find module '../activeLead'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/activeLead.ts
export function resolveActiveLead<T extends { id: string }>(
  leads: T[],
  requestedLeadId?: string | null
): T | null {
  if (leads.length === 0) return null;
  if (requestedLeadId) {
    const match = leads.find((lead) => lead.id === requestedLeadId);
    if (match) return match;
  }
  return leads[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/activeLead.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/activeLead.ts lib/__tests__/activeLead.test.ts
git commit -m "feat(hub): add pure active-lead resolver for multi-role switcher"
```

---

### Task 2: Additive `lead_id` column on `fitment_interviews`

**Files:**
- Create: `supabase/migrations/0048_fitment_interviews_lead_id.sql`

**Interfaces:**
- Produces: `fitment_interviews.lead_id uuid null references fitment_leads(id)`, indexed. Nullable and unused by any read path in this phase — Task 3 starts writing it, Phase 3 starts reading it.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0048_fitment_interviews_lead_id.sql
alter table fitment_interviews
  add column if not exists lead_id uuid references fitment_leads(id);

create index if not exists fitment_interviews_lead_id_idx on fitment_interviews(lead_id);

-- Backfill existing rows: match each interview to the most recent lead with
-- the same user_id + role_title at the time of the interview. This is a
-- best-effort match on the same fragile role_title text the app has always
-- used, kept only for historical rows -- new rows get lead_id set directly
-- at insert time (Task 3), never inferred.
update fitment_interviews fi
set lead_id = (
  select fl.id
  from fitment_leads fl
  where fl.user_id = fi.user_id
    and fl.role_title = fi.role_title
  order by fl.created_at desc
  limit 1
)
where fi.lead_id is null;
```

- [ ] **Step 2: Apply migration to local/dev Supabase project**

Run: apply via the project's normal Supabase migration flow (this repo has no `supabase db` script in `package.json` — push through the same channel the last migration, `0047_fitment_leads_override_lock.sql`, went through).

- [ ] **Step 3: Verify backfill coverage**

Run this query against the dev database and confirm the unmatched count is either `0` or explainable (e.g. an interview row whose lead was later purged by `0044_purge_candidate_data.sql`):

```sql
select count(*) as unmatched
from fitment_interviews
where lead_id is null;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0048_fitment_interviews_lead_id.sql
git commit -m "feat(db): add nullable lead_id column to fitment_interviews with backfill"
```

---

### Task 3: Dual-write `lead_id` on new interview rows

**Files:**
- Modify: `app/api/hub/start-ai-interview/route.ts:110-117` (add `id` to the lead select), `:188-197` (insert `lead_id`)
- Test: `app/api/hub/start-ai-interview/__tests__/route.test.ts` (existing file — extend it)

**Interfaces:**
- Consumes: `resolveActiveLead` is NOT used here — this route already resolves its lead by `role_title` (unchanged in this phase); Task 3 only adds `lead_id` to the write.

- [ ] **Step 1: Read the existing test file to match its mock style**

Read `app/api/hub/start-ai-interview/__tests__/route.test.ts` in full before writing the new assertion — match its existing Supabase mock chain shape exactly (do not introduce a second mocking style in the same file).

- [ ] **Step 2: Write the failing test**

Add this assertion to the existing "successfully starts an interview" test (or the closest equivalent) in `app/api/hub/start-ai-interview/__tests__/route.test.ts`, asserting the insert payload now includes `lead_id`:

```typescript
expect(insertMock).toHaveBeenCalledWith(
  expect.objectContaining({
    lead_id: "lead-abc-123",
  })
);
```

Make sure the test's fake `fitment_leads` select response includes `id: "lead-abc-123"` alongside the existing `ib_job_id`/`ib_applied_job_id`/`candidate_level` fields so the route has something real to pass through.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/api/hub/start-ai-interview/__tests__/route.test.ts`
Expected: FAIL — insert payload missing `lead_id`

- [ ] **Step 4: Update the route**

In `app/api/hub/start-ai-interview/route.ts`, change the lead select at line 110-117 to also fetch `id`:

```typescript
  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("id, ib_job_id, ib_applied_job_id, candidate_level")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```

Then change the insert at line 188-197 to include it:

```typescript
  const { error: insertError } = await admin.from("fitment_interviews").insert({
    user_id: user.id,
    role_title: roleTitle,
    lead_id: lead.id,
    ib_job_id: ibJobId,
    ib_agent_id: ibAgentId,
    ib_candidate_id: candidateId,
    status: "invited",
    magic_link: magicLink,
    magic_link_expires_at: magicLinkExpiresAt,
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/api/hub/start-ai-interview/__tests__/route.test.ts`
Expected: PASS, including the pre-existing tests in this file (no regressions)

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — this route's callers (`interview/status`, `interview/resume`, `interview/launch-link`) do not read `lead_id` yet, so they must be unaffected.

- [ ] **Step 7: Commit**

```bash
git add app/api/hub/start-ai-interview/route.ts app/api/hub/start-ai-interview/__tests__/route.test.ts
git commit -m "feat(hub): dual-write lead_id on new fitment_interviews rows"
```

---

### Task 4: First real opt-in read path — `?lead=` on the dashboard

**Files:**
- Modify: `app/hub/account/page.tsx:16-47`

**Interfaces:**
- Consumes: `resolveActiveLead` from Task 1 (`lib/activeLead.ts`).
- Produces: dashboard now honors `?lead=<id>` if present and valid; falls back to today's exact behavior (`leads[0]`) otherwise. No link in the UI points at this param yet — it's reachable only by typing the URL, so it's invisible to normal traffic while being genuinely testable end-to-end.

- [ ] **Step 1: Read the current page in full**

Read `app/hub/account/page.tsx` completely (it's longer than the excerpt already seen) before editing — confirm every downstream use of `current`/`leads[0]` below line 47 so the resolver swap doesn't miss one.

- [ ] **Step 2: Update the page signature and lead resolution**

Change:

```typescript
export default async function AccountPage() {
```

to:

```typescript
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
```

(Matches this repo's existing async-searchParams convention — see `app/admin/candidates/[userId]/page.tsx:26-32`.)

Change:

```typescript
  const current = leads[0];
```

to:

```typescript
  const { lead: requestedLeadId } = await searchParams;
  const current = resolveActiveLead(leads, requestedLeadId);
  if (!current) {
    redirect("/hub/account");
  }
```

Add the import at the top of the file:

```typescript
import { resolveActiveLead } from "@/lib/activeLead";
```

- [ ] **Step 3: Manually verify no regression**

Run the dev server (`npm run dev`) and load `/hub/account` with no query param — confirm it renders identically to before (same score, same role title). This is a manual check, not a unit test, because this file has no existing test coverage to extend (confirm that by checking for `app/hub/account/__tests__/page.test.tsx` — if it doesn't exist, this manual step is the verification for this task).

- [ ] **Step 4: Manually verify the new opt-in path**

With at least two `fitment_leads` rows for one test user (or in dev data), load `/hub/account?lead=<id-of-the-older-lead>` and confirm the page now shows that lead's role/score instead of the latest one.

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/page.tsx
git commit -m "feat(hub): dashboard honors optional ?lead= param via resolveActiveLead"
```

---

## Phase 1 exit criteria

- `npm test` passes in full.
- `npm run build` succeeds (per the standing lesson in [[prod_deploy_broken_untracked_dependency]] — always build, not just typecheck, before considering a phase done).
- A candidate who never touches `?lead=` sees zero change anywhere.
- `fitment_interviews.lead_id` is populated on all new rows going forward and backfilled (or explainably null) on old ones.
- Nothing in Phase 2-5's scope (personality dedup, interview cutover, recruiter split, full UI wiring) has been started — each gets written and reviewed as its own plan immediately before it's picked up, per `plans/2026-08-21-multi-role-switcher-design.md`.
