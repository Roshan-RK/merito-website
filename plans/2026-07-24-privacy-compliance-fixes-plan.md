# Privacy & Compliance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a false claim in the privacy policy, add missing consent copy on the referee feedback form, and build an admin CLI tool that can actually act on a candidate's data-deletion request.

**Architecture:** Three independent pieces. Two are content-only edits to existing pages. The third is a new standalone Node CLI script (no web endpoint, run manually by ops with the Supabase service-role key), split into a pure/testable deletion-plan builder and a thin executor that talks to Supabase and (best-effort) IntervueBox.

**Tech Stack:** Next.js/React (content edits), plain Node ESM + `@supabase/supabase-js` (CLI script, no bundler/TS runtime available for standalone scripts), Vitest (unit tests).

## Global Constraints

- Deletion tooling is an admin-run CLI script, not a self-serve dashboard button.
- `razorpay_transactions` and `counselling_requests` rows are anonymized (user_id/lead_id set to `NULL`), never hard-deleted — the financial/audit trail (amount, order_id, status, dates) is retained.
- Deletion closes the Supabase auth account entirely (`auth.admin.deleteUser`), not just the data rows.
- IntervueBox has no confirmed delete/withdraw endpoint as of 2026-07-24. The tool must not guess at one — it reports "MANUAL FOLLOW-UP NEEDED" instead of making a fake vendor call.
- Standalone scripts in this repo run via plain `node --env-file=.env.local <path>` (confirmed: no `tsx`/`ts-node` dependency exists in `package.json`), so anything imported directly by a script must be plain `.mjs`, not `.ts`.
- Vitest only picks up `**/*.test.ts` (per `vitest.config.ts`) — test files must be `.test.ts` even when importing a plain `.mjs` module under test; this works fine since Vite/Vitest resolves plain JS imports from a TS test file without issue.
- No component-render test infrastructure exists in this repo (Vitest `environment` is `"node"`, no `jsdom`/`@testing-library/react` present). Do not add one for two paragraphs of static copy — verify those manually via the dev server instead (YAGNI).

---

### Task 1: Privacy policy copy fix

**Files:**
- Modify: `app/privacy/page.tsx:41-61`

**Interfaces:** None — static content only, no props/exports change.

- [ ] **Step 1: Replace the "What we share" and "Data retention and deletion" sections**

Replace lines 41-61 of `app/privacy/page.tsx` (currently):

```tsx
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            What we share
          </h2>
          <p>
            We never share your raw fitment score, gaps, or CV content with recruiters or
            third parties without your explicit action. Once your Merito HUB profile supports
            it, you will control exactly which sections of your profile are visible to
            recruiters.
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            Data retention and deletion
          </h2>
          <p>
            We retain your CV text and fitment data for as long as your account is active.
            You can request deletion of your data at any time by contacting us at{" "}
            <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">
              admin@merito.ai
            </a>
            .
          </p>
```

with:

```tsx
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            What we share
          </h2>
          <p>
            To generate your fitment score — and, if you request it, your AI mock
            interview — we share your CV content and job description with
            IntervueBox, our AI assessment partner, who process this data on our
            behalf. If you pay for a report or a session, payment is processed
            directly by Razorpay; Merito never sees or stores your card details.
          </p>
          <p>
            We never share your fitment score, gaps, or CV content with recruiters
            or other third parties without your explicit action. Once your Merito
            HUB profile supports it, you will control exactly which sections of
            your profile are visible to recruiters.
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            Data retention and deletion
          </h2>
          <p>
            We retain your CV text and fitment data for as long as your account is active.
            You can request deletion of your data at any time by contacting us at{" "}
            <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">
              admin@merito.ai
            </a>
            . On request, we delete your fitment, interview, personality test, and
            reference data and close your account. Payment records are retained in
            anonymized form, with your identity removed, as required for
            accounting purposes.
          </p>
```

- [ ] **Step 2: Verify manually**

Run the dev server (`npm run dev`), visit `http://localhost:3000/privacy`, and confirm:
- The "What we share" section names IntervueBox and Razorpay.
- The "Data retention and deletion" section describes account closure and anonymized payment retention.

- [ ] **Step 3: Commit**

```bash
git add app/privacy/page.tsx
git commit -m "fix(privacy): correct false third-party sharing claim, name IntervueBox/Razorpay"
```

---

### Task 2: Referee consent notice

**Files:**
- Modify: `app/hub/references/feedback/[token]/FeedbackForm.tsx:88-92`

**Interfaces:** None — static content only, no props/exports change.

- [ ] **Step 1: Insert a consent paragraph above the rating form**

In `app/hub/references/feedback/[token]/FeedbackForm.tsx`, the `ready` state currently renders (lines 88-92):

```tsx
  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem" }}>
        Rate {state.refereeName}
      </h1>
```

Change it to:

```tsx
  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem" }}>
        Rate {state.refereeName}
      </h1>
      <p style={{ fontSize: 12.5, color: "#6b6b6b", lineHeight: 1.6, margin: 0 }}>
        Merito collects this feedback — including your name, email, and ratings —
        to help evaluate the candidate who invited you. See our{" "}
        <a href="/privacy" style={{ color: "#ed1a24", textDecoration: "underline" }}>
          Privacy Policy
        </a>{" "}
        for details on how this information is used and retained.
      </p>
```

- [ ] **Step 2: Verify manually**

Run the dev server, open a valid feedback link (`/hub/references/feedback/<token>` for an existing referee token in the dev DB, or trigger one via the references flow), and confirm the consent paragraph appears above the rating grid with a working link to `/privacy`.

- [ ] **Step 3: Commit**

```bash
git add "app/hub/references/feedback/[token]/FeedbackForm.tsx"
git commit -m "feat(references): add consent notice to referee feedback form"
```

---

### Task 3: Pure deletion-plan builder

**Files:**
- Create: `scripts/admin/deleteCandidatePlan.mjs`
- Test: `scripts/admin/__tests__/deleteCandidatePlan.test.ts`

**Interfaces:**
- Produces: `buildDeletionPlan(snapshot: { userId: string, refereeIds?: string[], referenceCheckIds?: string[] }) -> Array<{ type: "anonymize", table: string, match: Record<string, string|string[]>, set: Record<string, null> } | { type: "delete", table: string, match: Record<string, string|string[]> }>` — a pure function, no I/O.

- [ ] **Step 1: Write the failing tests**

Create `scripts/admin/__tests__/deleteCandidatePlan.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildDeletionPlan } from "../deleteCandidatePlan.mjs";

describe("buildDeletionPlan", () => {
  it("anonymizes payment tables first, then deletes assessment tables, for a user with no references", () => {
    const plan = buildDeletionPlan({ userId: "user-1" });

    expect(plan).toEqual([
      { type: "anonymize", table: "razorpay_transactions", match: { user_id: "user-1" }, set: { user_id: null, lead_id: null } },
      { type: "anonymize", table: "counselling_requests", match: { user_id: "user-1" }, set: { user_id: null } },
      { type: "delete", table: "reference_checks", match: { user_id: "user-1" } },
      { type: "delete", table: "report_unlocks", match: { user_id: "user-1" } },
      { type: "delete", table: "fitment_interviews", match: { user_id: "user-1" } },
      { type: "delete", table: "fitment_reports", match: { user_id: "user-1" } },
      { type: "delete", table: "personality_tests", match: { user_id: "user-1" } },
      { type: "delete", table: "fitment_leads", match: { user_id: "user-1" } },
    ]);
  });

  it("deletes reference_tokens and referees before reference_checks when the user has referees", () => {
    const plan = buildDeletionPlan({
      userId: "user-1",
      refereeIds: ["ref-a", "ref-b"],
      referenceCheckIds: ["check-1"],
    });

    const tokenIdx = plan.findIndex((s) => s.table === "reference_tokens");
    const refereesIdx = plan.findIndex((s) => s.table === "referees");
    const checksIdx = plan.findIndex((s) => s.table === "reference_checks");

    expect(tokenIdx).toBeGreaterThanOrEqual(0);
    expect(refereesIdx).toBeGreaterThan(tokenIdx);
    expect(checksIdx).toBeGreaterThan(refereesIdx);
    expect(plan[tokenIdx]).toEqual({ type: "delete", table: "reference_tokens", match: { reference_id: ["ref-a", "ref-b"] } });
    expect(plan[refereesIdx]).toEqual({ type: "delete", table: "referees", match: { reference_check_id: ["check-1"] } });
  });

  it("places both payment anonymization steps before any delete step", () => {
    const plan = buildDeletionPlan({ userId: "user-1", refereeIds: ["ref-a"], referenceCheckIds: ["check-1"] });
    const firstDeleteIdx = plan.findIndex((s) => s.type === "delete");
    const anonymizeIdxs = plan
      .map((s, i) => (s.type === "anonymize" ? i : -1))
      .filter((i) => i >= 0);

    expect(anonymizeIdxs.every((i) => i < firstDeleteIdx)).toBe(true);
  });

  it("places fitment_leads last, since razorpay_transactions.lead_id and report_unlocks.lead_id reference it", () => {
    const plan = buildDeletionPlan({ userId: "user-1" });

    expect(plan[plan.length - 1]).toEqual({ type: "delete", table: "fitment_leads", match: { user_id: "user-1" } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run scripts/admin/__tests__/deleteCandidatePlan.test.ts`
Expected: FAIL - `Cannot find module '../deleteCandidatePlan.mjs'` (or similar) since the module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `scripts/admin/deleteCandidatePlan.mjs`:

```js
/**
 * Pure builder for the ordered list of DB operations a candidate deletion
 * requires. No I/O here -- the caller (delete-candidate.mjs) gathers the
 * snapshot and executes each step against Supabase.
 *
 * Order matters: razorpay_transactions.lead_id and report_unlocks.lead_id
 * both reference fitment_leads(id) with no ON DELETE CASCADE, so
 * fitment_leads must be anonymized-away-from (razorpay_transactions) or
 * deleted-after (report_unlocks) rather than deleted first. Similarly,
 * reference_tokens -> referees -> reference_checks must be torn down in
 * that child-first order.
 */
export function buildDeletionPlan({ userId, refereeIds = [], referenceCheckIds = [] }) {
  const steps = [];

  steps.push({
    type: "anonymize",
    table: "razorpay_transactions",
    match: { user_id: userId },
    set: { user_id: null, lead_id: null },
  });
  steps.push({
    type: "anonymize",
    table: "counselling_requests",
    match: { user_id: userId },
    set: { user_id: null },
  });

  if (refereeIds.length > 0) {
    steps.push({ type: "delete", table: "reference_tokens", match: { reference_id: refereeIds } });
  }
  if (referenceCheckIds.length > 0) {
    steps.push({ type: "delete", table: "referees", match: { reference_check_id: referenceCheckIds } });
  }
  steps.push({ type: "delete", table: "reference_checks", match: { user_id: userId } });

  steps.push({ type: "delete", table: "report_unlocks", match: { user_id: userId } });
  steps.push({ type: "delete", table: "fitment_interviews", match: { user_id: userId } });
  steps.push({ type: "delete", table: "fitment_reports", match: { user_id: userId } });
  steps.push({ type: "delete", table: "personality_tests", match: { user_id: userId } });
  steps.push({ type: "delete", table: "fitment_leads", match: { user_id: userId } });

  return steps;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/admin/__tests__/deleteCandidatePlan.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/admin/deleteCandidatePlan.mjs scripts/admin/__tests__/deleteCandidatePlan.test.ts
git commit -m "feat(admin): add pure deletion-plan builder for candidate data erasure"
```

---

### Task 4: Delete-candidate CLI script

**Files:**
- Create: `scripts/admin/delete-candidate.mjs`

**Interfaces:**
- Consumes: `buildDeletionPlan` from Task 3 (`scripts/admin/deleteCandidatePlan.mjs`), `createClient` from `@supabase/supabase-js` (already a project dependency).
- Produces: a runnable CLI - `node --env-file=.env.local scripts/admin/delete-candidate.mjs <email> [--dry-run]`.

- [ ] **Step 1: Write the script**

Create `scripts/admin/delete-candidate.mjs`:

```js
import { createClient } from "@supabase/supabase-js";
import { buildDeletionPlan } from "./deleteCandidatePlan.mjs";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!url || !serviceKey) {
  console.error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
if (!email || email.startsWith("--")) {
  console.error("usage: node delete-candidate.mjs <email> [--dry-run]");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function gatherSnapshot(targetEmail) {
  const { data: userList, error: userErr } = await admin.auth.admin.listUsers();
  if (userErr) throw new Error(`Failed to list users: ${userErr.message}`);
  const user = userList.users.find((u) => u.email === targetEmail);
  if (!user) throw new Error(`No auth user found for ${targetEmail}`);

  const { data: leads, error: leadsErr } = await admin
    .from("fitment_leads")
    .select("id, ib_job_id, ib_resume_id, ib_applied_job_id")
    .eq("user_id", user.id);
  if (leadsErr) throw new Error(`Failed to read fitment_leads: ${leadsErr.message}`);

  const { data: interviews, error: interviewsErr } = await admin
    .from("fitment_interviews")
    .select("ib_job_id, ib_agent_id, ib_candidate_id")
    .eq("user_id", user.id);
  if (interviewsErr) throw new Error(`Failed to read fitment_interviews: ${interviewsErr.message}`);

  const { data: referenceChecks, error: refChecksErr } = await admin
    .from("reference_checks")
    .select("id")
    .eq("user_id", user.id);
  if (refChecksErr) throw new Error(`Failed to read reference_checks: ${refChecksErr.message}`);
  const referenceCheckIds = (referenceChecks ?? []).map((r) => r.id);

  let refereeIds = [];
  if (referenceCheckIds.length > 0) {
    const { data: referees, error: refereesErr } = await admin
      .from("referees")
      .select("id")
      .in("reference_check_id", referenceCheckIds);
    if (refereesErr) throw new Error(`Failed to read referees: ${refereesErr.message}`);
    refereeIds = (referees ?? []).map((r) => r.id);
  }

  return {
    userId: user.id,
    email: targetEmail,
    leadIntervueBoxIds: (leads ?? []).map((l) => ({ jobId: l.ib_job_id, resumeId: l.ib_resume_id, appliedJobId: l.ib_applied_job_id })),
    interviewIntervueBoxIds: (interviews ?? []).map((i) => ({ jobId: i.ib_job_id, agentId: i.ib_agent_id, candidateId: i.ib_candidate_id })),
    referenceCheckIds,
    refereeIds,
  };
}

// IntervueBox does not currently expose a documented delete/withdraw
// endpoint (unconfirmed as of 2026-07-24 -- see
// specs/2026-07-24-privacy-compliance-fixes-design.md, "Open dependency").
// Guessing at an endpoint path risks hitting the wrong resource on a live
// vendor account, so this always reports manual follow-up instead. Replace
// this function with a real API call once the endpoint is confirmed.
function intervueBoxDeleteWarnings(snapshot) {
  const warnings = [];
  for (const ids of snapshot.leadIntervueBoxIds) {
    if (ids.appliedJobId) {
      warnings.push(
        `MANUAL FOLLOW-UP NEEDED: IntervueBox applicant ${ids.appliedJobId} (job ${ids.jobId}, resume ${ids.resumeId}) has no automated delete path yet.`
      );
    }
  }
  for (const ids of snapshot.interviewIntervueBoxIds) {
    warnings.push(
      `MANUAL FOLLOW-UP NEEDED: IntervueBox interview agent ${ids.agentId} (candidate ${ids.candidateId}) has no automated delete path yet.`
    );
  }
  return warnings;
}

function describeStep(step) {
  const matchDesc = Object.entries(step.match)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(",")}]` : v}`)
    .join(", ");
  if (step.type === "anonymize") {
    return `ANONYMIZE ${step.table} WHERE ${matchDesc} SET ${JSON.stringify(step.set)}`;
  }
  return `DELETE FROM ${step.table} WHERE ${matchDesc}`;
}

async function executeStep(step) {
  if (step.type === "anonymize") {
    let query = admin.from(step.table).update(step.set);
    for (const [key, value] of Object.entries(step.match)) {
      query = query.eq(key, value);
    }
    const { error } = await query;
    if (error) throw new Error(`Failed to anonymize ${step.table}: ${error.message}`);
    return;
  }
  let query = admin.from(step.table).delete();
  for (const [key, value] of Object.entries(step.match)) {
    query = Array.isArray(value) ? query.in(key, value) : query.eq(key, value);
  }
  const { error } = await query;
  if (error) throw new Error(`Failed to delete from ${step.table}: ${error.message}`);
}

async function main() {
  console.log(`Gathering data for ${email}...`);
  const snapshot = await gatherSnapshot(email);
  const plan = buildDeletionPlan(snapshot);
  const ibWarnings = intervueBoxDeleteWarnings(snapshot);

  console.log(`\nPlan for ${email} (user ${snapshot.userId}):`);
  for (const step of plan) {
    console.log(`  ${dryRun ? "[DRY RUN] " : ""}${describeStep(step)}`);
  }
  console.log(`  ${dryRun ? "[DRY RUN] " : ""}DELETE auth user ${snapshot.userId}`);

  if (dryRun) {
    console.log("\nDry run only -- no changes made.");
    if (ibWarnings.length > 0) {
      console.log("\nIntervueBox warnings that would apply:");
      ibWarnings.forEach((w) => console.log(`  ${w}`));
    }
    return;
  }

  let completed = 0;
  try {
    for (const step of plan) {
      await executeStep(step);
      completed++;
    }
  } catch (err) {
    console.error(`\nFAILED at step ${completed + 1} of ${plan.length}: ${err.message}`);
    console.error(`${completed} step(s) completed before this failure. Inspect state before retrying.`);
    process.exit(1);
  }

  try {
    const { error } = await admin.auth.admin.deleteUser(snapshot.userId);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error(`\nDATA DELETED, AUTH USER STILL EXISTS -- retry auth deletion manually. Error: ${err.message}`);
    process.exit(1);
  }

  console.log(`\nDone. Deleted/anonymized ${plan.length} table(s) and closed the auth account.`);
  if (ibWarnings.length > 0) {
    console.log("\nIntervueBox manual follow-up needed:");
    ibWarnings.forEach((w) => console.log(`  ${w}`));
  }
}

main().catch((err) => {
  console.error(`\nUnexpected error: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Sanity-check the script starts and validates arguments**

Run: `node scripts/admin/delete-candidate.mjs`
Expected: prints `usage: node delete-candidate.mjs <email> [--dry-run]` and exits non-zero (no `SUPABASE_URL`/service key needed to hit this path since argument validation runs first - confirm by checking the exit code: `echo $?` on the next line should print `1`).

- [ ] **Step 3: Commit**

```bash
git add scripts/admin/delete-candidate.mjs
git commit -m "feat(admin): add delete-candidate CLI for data-erasure requests"
```

---

### Task 5: Real validation against the disposable test candidate

**Files:** None modified - this task runs the Task 4 script against live data.

**Interfaces:** None - verification task.

- [ ] **Step 1: Dry-run against the seeded test candidate**

From the `hub-payu-integration` worktree (where `.env.local` with real Supabase credentials already exists):

```bash
cd d:/Work-Projects/merito-website-v2/.worktrees/hub-payu-integration
cp ../../scripts/admin/deleteCandidatePlan.mjs ./_scratch-deleteCandidatePlan.mjs
cp ../../scripts/admin/delete-candidate.mjs ./_scratch-delete-candidate.mjs
node --env-file=.env.local _scratch-delete-candidate.mjs roshanrk.ai@gmail.com --dry-run
```

Expected output: a plan listing `ANONYMIZE razorpay_transactions`, `ANONYMIZE counselling_requests`, `DELETE FROM report_unlocks`, `DELETE FROM fitment_leads`, and `DELETE auth user <id>` - all prefixed `[DRY RUN]` - followed by `Dry run only -- no changes made.` No `reference_tokens`/`referees`/`reference_checks` lines are expected (this test candidate never went through the references flow).

- [ ] **Step 2: Confirm the dry-run touched nothing**

```bash
node --env-file=.env.local -e "
import('@supabase/supabase-js').then(async ({ createClient }) => {
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await admin.from('fitment_leads').select('id').eq('email', 'roshanrk.ai@gmail.com');
  console.log('fitment_leads rows still present:', data.length);
});
"
```

Expected: `fitment_leads rows still present: <same count as before the dry run>` (not 0, confirming dry-run made no changes).

- [ ] **Step 3: Run for real**

```bash
node --env-file=.env.local _scratch-delete-candidate.mjs roshanrk.ai@gmail.com
```

Expected: same plan printed without `[DRY RUN]` prefixes, followed by `Done. Deleted/anonymized <N> table(s) and closed the auth account.` Since this test candidate's `fitment_leads.ib_applied_job_id` was never populated by a real IntervueBox call (it was seeded directly earlier this session), expect **no** IntervueBox warnings to print.

- [ ] **Step 4: Confirm the real run worked**

Re-run the same check from Step 2:

```bash
node --env-file=.env.local -e "
import('@supabase/supabase-js').then(async ({ createClient }) => {
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await admin.from('fitment_leads').select('id').eq('email', 'roshanrk.ai@gmail.com');
  console.log('fitment_leads rows still present:', data.length);
  const { data: users } = await admin.auth.admin.listUsers();
  console.log('auth user still exists:', users.users.some((u) => u.email === 'roshanrk.ai@gmail.com'));
});
"
```

Expected: `fitment_leads rows still present: 0` and `auth user still exists: false`.

- [ ] **Step 5: Clean up the scratch copies**

```bash
rm _scratch-deleteCandidatePlan.mjs _scratch-delete-candidate.mjs
```

(No commit for this task - it's a live verification run, not a code change. `scripts/admin/*.mjs` are already committed from Tasks 3-4.)
