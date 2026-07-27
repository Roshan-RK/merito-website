# AI Interview Difficulty + Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the candidate's self-selected seniority (`candidate_level`) control the AI mock-interview's duration (30 min for entry/mid, 45 min for senior) via IntervueBox's `maxInterviewMinutes` field.

**Architecture:** Add a `candidate_level` column to `fitment_leads`, capture it on the fitment-check form, thread it through `start-ai-interview` into `lib/intervuebox/agents.ts`'s `createInterviewAgent`, which maps it to `maxInterviewMinutes` (15/30/45 are the only values IntervueBox's API accepts) instead of the current hardcoded `30`.

**Tech Stack:** Next.js App Router route handlers, Supabase (Postgres), Vitest.

## Global Constraints

- `candidate_level` values are exactly `'entry' | 'mid' | 'senior'` — no other strings.
- `maxInterviewMinutes` sent to IntervueBox must be one of `15 | 30 | 45` (their API's only allowed values). Mapping for this feature: `entry` → 30, `mid` → 30, `senior` → 45.
- Complexity/difficulty API param is **out of scope for this plan** — no code for it. Do not add it speculatively.
- Follow existing test patterns exactly (see `lib/intervuebox/__tests__/agents.test.ts`, `app/api/hub/start-ai-interview/__tests__/route.test.ts`, `app/api/hub/fitment-check/__tests__/route.test.ts`) — Vitest, `vi.mock` at module top, `beforeEach` reset blocks.
- Run tests with `npm test` (= `vitest run`).

---

### Task 1: `candidate_level` migration

**Files:**
- Create: `supabase/migrations/0012_fitment_leads_candidate_level.sql`

**Interfaces:**
- Produces: `fitment_leads.candidate_level` column, type `text`, values constrained to `entry|mid|senior`, `not null default 'mid'` (existing rows get `mid` so the column can be `not null` immediately).

- [ ] **Step 1: Write the migration**

```sql
alter table fitment_leads
  add column if not exists candidate_level text not null default 'mid'
  check (candidate_level in ('entry', 'mid', 'senior'));
```

- [ ] **Step 2: Verify the file matches the existing migration style**

Run: compare against `supabase/migrations/0011_fitment_leads_phone.sql` — same `alter table fitment_leads add column if not exists` shape.
Expected: consistent style, no `create table`, no RLS changes (this is an existing table).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0012_fitment_leads_candidate_level.sql
git commit -m "feat(db): add candidate_level column to fitment_leads"
```

Note: this migration is not applied automatically by any test — it must be run against the real Supabase project the same way `0007`-`0011` were (manually, by the user, once this plan is merged).

---

### Task 2: `durationForLevel` + `createInterviewAgent` duration param

**Files:**
- Modify: `lib/intervuebox/agents.ts`
- Test: `lib/intervuebox/__tests__/agents.test.ts`

**Interfaces:**
- Consumes: nothing new — this is the leaf of the chain.
- Produces:
  - `export type CandidateLevel = "entry" | "mid" | "senior";`
  - `export function durationForLevel(level: CandidateLevel): 30 | 45`
  - `export async function createInterviewAgent(jobId: string, roleTitle: string, candidateLevel: CandidateLevel): Promise<{ ibAgentId: string }>` (signature changes from 2 args to 3 - **required**, not optional, so every call site must be updated in this plan)

- [ ] **Step 1: Write the failing tests**

Add to `lib/intervuebox/__tests__/agents.test.ts`, replacing the existing `createInterviewAgent` test's call (it currently calls with 2 args and expects `maxInterviewMinutes: 30` unconditionally - update it too, since the signature is changing):

```typescript
describe("durationForLevel", () => {
  it("maps entry and mid to 30 minutes", async () => {
    const { durationForLevel } = await import("../agents");
    expect(durationForLevel("entry")).toBe(30);
    expect(durationForLevel("mid")).toBe(30);
  });

  it("maps senior to 45 minutes", async () => {
    const { durationForLevel } = await import("../agents");
    expect(durationForLevel("senior")).toBe(45);
  });
});

describe("createInterviewAgent", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("posts a 30-minute interview for an entry-level candidate", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      interviewId: "INT_123",
      title: "Technical Interview",
      status: "ACTIVE",
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
    });
    const { createInterviewAgent } = await import("../agents");

    const result = await createInterviewAgent("JOB_123", "Software Engineer", "entry");

    expect(result).toEqual({ ibAgentId: "INT_123" });
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
    });
  });

  it("posts a 45-minute interview for a senior candidate", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      interviewId: "INT_124",
      title: "Technical Interview",
      status: "ACTIVE",
      maxInterviewMinutes: 45,
      interviewType: "technical",
      isCriteriaMatch: false,
    });
    const { createInterviewAgent } = await import("../agents");

    await createInterviewAgent("JOB_123", "Software Engineer", "senior");

    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody.maxInterviewMinutes).toBe(45);
  });
});
```

Also update the pre-existing test in the same file (the one titled `"posts default interview settings and returns the interview id"`) to pass a third argument, e.g. `await createInterviewAgent("JOB_123", "Software Engineer", "mid")`, since the function will require it after Step 3.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- agents.test.ts`
Expected: FAIL - `durationForLevel is not a function` / `createInterviewAgent` called with wrong arity or returns `maxInterviewMinutes: 30` for the senior case.

- [ ] **Step 3: Implement**

In `lib/intervuebox/agents.ts`, add after the existing `InterviewType` export and before `createInterviewAgent`:

```typescript
export type CandidateLevel = "entry" | "mid" | "senior";

export function durationForLevel(level: CandidateLevel): 30 | 45 {
  return level === "senior" ? 45 : 30;
}
```

Change `createInterviewAgent`'s signature and body:

```typescript
export async function createInterviewAgent(
  jobId: string,
  roleTitle: string,
  candidateLevel: CandidateLevel
): Promise<{ ibAgentId: string }> {
  const response = await intervueBoxFetch<CreateInterviewAgentResponse>(`/public/jobs/${jobId}/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maxInterviewMinutes: durationForLevel(candidateLevel),
      interviewType: inferInterviewType(roleTitle),
      isCriteriaMatch: false,
    }),
  });
  return { ibAgentId: response.interviewId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- agents.test.ts`
Expected: PASS, all `createInterviewAgent` and `durationForLevel` tests green. `inferInterviewType` tests are untouched and still pass.

- [ ] **Step 5: Commit**

```bash
git add lib/intervuebox/agents.ts lib/intervuebox/__tests__/agents.test.ts
git commit -m "feat(intervuebox): map candidate level to interview duration"
```

---

### Task 3: `fitment-check` route accepts and stores `candidateLevel`

**Files:**
- Modify: `app/api/hub/fitment-check/route.ts`
- Test: `app/api/hub/fitment-check/__tests__/route.test.ts`

**Interfaces:**
- Consumes: nothing from Task 2 (this route doesn't call `createInterviewAgent`).
- Produces: `fitment_leads.candidate_level` populated on insert, from the form field `candidateLevel`. Invalid/missing values are rejected with 400.

- [ ] **Step 1: Write the failing tests**

Add to `app/api/hub/fitment-check/__tests__/route.test.ts`. First, add `candidateLevel` to the default form in the `buildForm` helper so existing tests keep passing once the field becomes required:

```typescript
function buildForm(overrides: Record<string, string | Blob> = {}) {
  const form = new FormData();
  form.set("name", "Jane Doe");
  form.set("email", "candidate@example.com");
  form.set("role", "Senior Product Manager");
  form.set("jdText", "We need a PM who can ship.");
  form.set("phone", "+919876543210");
  form.set("candidateLevel", "senior");
  form.set("recaptchaToken", "token-123");
  form.set("cv", new Blob(["cv bytes"], { type: "application/pdf" }), "resume.pdf");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}
```

Then add new test cases:

```typescript
it("rejects a submission with no candidateLevel", async () => {
  const form = buildForm();
  form.delete("candidateLevel");
  const { POST } = await importRoute();
  const request = new Request("http://localhost/api/hub/fitment-check", {
    method: "POST",
    body: form,
  });
  const response = await POST(request);
  expect(response.status).toBe(400);
});

it("rejects a submission with an unrecognized candidateLevel", async () => {
  const { POST } = await importRoute();
  const request = new Request("http://localhost/api/hub/fitment-check", {
    method: "POST",
    body: buildForm({ candidateLevel: "expert" }),
  });
  const response = await POST(request);
  expect(response.status).toBe(400);
});

it("stores candidateLevel on the fitment_leads insert", async () => {
  const { POST } = await importRoute();
  const request = new Request("http://localhost/api/hub/fitment-check", {
    method: "POST",
    body: buildForm({ candidateLevel: "entry" }),
  });
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(insertMock).toHaveBeenCalledWith(
    expect.objectContaining({ candidate_level: "entry" })
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- fitment-check`
Expected: FAIL - no `candidateLevel` validation exists yet, so the "no candidateLevel"/"unrecognized" tests get 200 instead of 400, and the insert test's `candidate_level` key is missing/`undefined`.

- [ ] **Step 3: Implement**

In `app/api/hub/fitment-check/route.ts`, add a validator near the top (after `isValidEmail`):

```typescript
const CANDIDATE_LEVELS = ["entry", "mid", "senior"] as const;
type CandidateLevel = (typeof CANDIDATE_LEVELS)[number];

function isCandidateLevel(value: string): value is CandidateLevel {
  return (CANDIDATE_LEVELS as readonly string[]).includes(value);
}
```

In the `POST` handler, alongside the other `normalize(form.get(...))` calls:

```typescript
const candidateLevel = normalize(form.get("candidateLevel"));
```

Add validation next to the existing `if (!phone)` check:

```typescript
if (!candidateLevel || !isCandidateLevel(candidateLevel)) {
  return Response.json({ error: "A valid experience level is required." }, { status: 400 });
}
```

In the `fitment_leads` insert object, add:

```typescript
candidate_level: candidateLevel,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- fitment-check`
Expected: PASS, all tests green including the three new ones. This route defines its own local `CandidateLevel` union rather than importing `lib/intervuebox/agents.ts`'s, to avoid a premature cross-module dependency - both unions must stay in sync manually since they represent the same domain concept (`entry|mid|senior`).

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/fitment-check/route.ts app/api/hub/fitment-check/__tests__/route.test.ts
git commit -m "feat(hub): capture and store candidate_level on fitment-check"
```

---

### Task 4: `FitmentChecker.tsx` experience-level dropdown

**Files:**
- Modify: `app/hub/FitmentChecker.tsx`

**Interfaces:**
- Consumes: nothing (client component, no shared types imported here).
- Produces: form POST includes `candidateLevel` set to one of `"entry" | "mid" | "senior"`.

- [ ] **Step 1: Add state**

In `FitmentChecker.tsx`, alongside the other `useState` declarations near the top of the component:

```typescript
const [candidateLevel, setCandidateLevel] = useState<"entry" | "mid" | "senior">("mid");
```

- [ ] **Step 2: Include it in the submitted form**

In `checkFit`, alongside the other `form.set(...)` calls:

```typescript
form.set("candidateLevel", candidateLevel);
```

- [ ] **Step 3: Add the select input to the JSX**

Insert this block right after the "The role you want" input's closing tag (after the `<input>` for `role`, before the "Job description" label block):

```tsx
<label className="block font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12, marginBottom: 6 }}>
  Your experience level
</label>
<select
  value={candidateLevel}
  onChange={(e) => setCandidateLevel(e.target.value as "entry" | "mid" | "senior")}
  className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
  style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
>
  <option value="entry">Entry-level</option>
  <option value="mid">Mid-level</option>
  <option value="senior">Senior</option>
</select>
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `/hub` (or wherever `FitmentChecker` renders), confirm the "Your experience level" dropdown appears between "The role you want" and "Job description", defaults to "Mid-level", and submitting a fitment check still works end-to-end (network tab shows `candidateLevel` in the POST body).

- [ ] **Step 5: Commit**

```bash
git add app/hub/FitmentChecker.tsx
git commit -m "feat(hub): add experience-level dropdown to fitment-check form"
```

---

### Task 5: `rescore-role` forwards the existing lead's `candidate_level`

**Files:**
- Modify: `app/api/hub/rescore-role/route.ts`
- Create: `app/api/hub/rescore-role/__tests__/route.test.ts` (no test file exists for this route yet)

**Interfaces:**
- Consumes: nothing from earlier tasks directly - mirrors the existing `phone`-forwarding pattern already in this file.
- Produces: forwards `candidateLevel` in the form it POSTs internally to `/api/hub/fitment-check`, sourced from the user's most recent `fitment_leads.candidate_level` (falls back to letting `fitment-check` reject if none exists - same as the current `phone` behavior, which does not force a value either).

- [ ] **Step 1: Write the failing test**

Create `app/api/hub/rescore-role/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: sessionFromMock,
  }),
}));

const maybeSingleMock = vi.fn();
const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
const notMock = vi.fn().mockReturnValue({ order: orderMock });
const eqMock = vi.fn().mockReturnValue({ not: notMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
const sessionFromMock = vi.fn(() => ({ select: selectMock }));

const claimFitmentLeadsMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/claimFitmentLeads", () => ({ claimFitmentLeads: claimFitmentLeadsMock }));

const originalFetch = global.fetch;
const fetchMock = vi.fn();

async function importRoute() {
  return await import("../route");
}

function buildForm() {
  const form = new FormData();
  form.set("role", "Senior Product Manager");
  form.set("jdText", "Updated JD text.");
  form.set("candidateLevel", "senior");
  form.set("cv", new Blob(["cv bytes"], { type: "application/pdf" }), "resume.pdf");
  return form;
}

describe("POST /api/hub/rescore-role", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    maybeSingleMock.mockReset();
    claimFitmentLeadsMock.mockClear();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("forwards the existing lead's candidate_level when present", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "user@example.com" } } });
    maybeSingleMock.mockResolvedValue({ data: { phone: "+919876543210", candidate_level: "senior" }, error: null });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "ready", score: 8 }), { status: 200 }));

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/rescore-role", {
      method: "POST",
      body: buildForm(),
    });
    await POST(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const forwardedBody = fetchMock.mock.calls[0][1].body as FormData;
    expect(forwardedBody.get("candidateLevel")).toBe("senior");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rescore-role`
Expected: FAIL - `forwardedBody.get("candidateLevel")` is whatever the client form already sent (`"senior"` in this test, coincidentally the same value - change the test's `buildForm` `candidateLevel` to `"mid"` and the mocked lead's `candidate_level` to `"senior"` if this coincidence makes the failure unclear; the point is the route must overwrite it from the DB lookup, not just pass through the client's value). Confirm failure by checking the route doesn't yet call `form.set("candidateLevel", ...)` anywhere - the assertion should fail once that distinction is in place.

- [ ] **Step 3: Implement**

In `app/api/hub/rescore-role/route.ts`, change the `existingLead` query to also select `candidate_level`, and forward it when present:

```typescript
const { data: existingLead } = await supabase
  .from("fitment_leads")
  .select("phone, candidate_level")
  .eq("user_id", user.id)
  .not("phone", "is", null)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (existingLead?.phone) {
  form.set("phone", existingLead.phone);
}

if (existingLead?.candidate_level) {
  form.set("candidateLevel", existingLead.candidate_level);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- rescore-role`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/rescore-role/route.ts app/api/hub/rescore-role/__tests__/route.test.ts
git commit -m "feat(hub): forward existing candidate_level on role rescoring"
```

---

### Task 6: `start-ai-interview` reads `candidate_level` and passes it to `createInterviewAgent`

**Files:**
- Modify: `app/api/hub/start-ai-interview/route.ts`
- Test: `app/api/hub/start-ai-interview/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `createInterviewAgent(jobId: string, roleTitle: string, candidateLevel: CandidateLevel)` and `type CandidateLevel` from `lib/intervuebox/agents.ts` (Task 2) - the mock in this test file must now be called with 3 args.
- Produces: no new exports - this is the final consumer in the chain.

- [ ] **Step 1: Write the failing test**

In `app/api/hub/start-ai-interview/__tests__/route.test.ts`, update the `leadMaybeSingleMock` payloads. In the test `"creates the interview agent, sends the invite, and saves an invited row"`:

```typescript
it("creates the interview agent, sends the invite, and saves an invited row", async () => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
  existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
  leadMaybeSingleMock.mockResolvedValue({
    data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "senior" },
    error: null,
  });
  getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
  createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
  sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });

  const { POST } = await importRoute();
  const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "invited" });
  expect(createInterviewAgentMock).toHaveBeenCalledWith("JOB_123", "Senior Product Manager", "senior");
  expect(sendInterviewInvitationMock).toHaveBeenCalledWith("INT_123", ["USR_123"]);
  expect(insertMock).toHaveBeenCalledWith(
    expect.objectContaining({
      user_id: "user-1",
      role_title: "Senior Product Manager",
      ib_job_id: "JOB_123",
      ib_agent_id: "INT_123",
      ib_candidate_id: "USR_123",
      status: "invited",
    })
  );
});
```

Also update the other four tests whose `leadMaybeSingleMock` payload is `{ ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123" }` (`"returns 500 if the IntervueBox chain fails"`, `"returns 500 if the invitation was sent but not actually invited"`, `"returns 500 with the insert error still surfaced..."`, `"treats a 23505 primary-key conflict..."`) to add `candidate_level: "mid"` to that same object, so every test exercises a realistic row shape:

```typescript
leadMaybeSingleMock.mockResolvedValue({
  data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "mid" },
  error: null,
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- start-ai-interview`
Expected: FAIL - `createInterviewAgentMock` was called with `("JOB_123", "Senior Product Manager")` (2 args), not `("JOB_123", "Senior Product Manager", "senior")`, so `toHaveBeenCalledWith` fails on argument count/value.

- [ ] **Step 3: Implement**

In `app/api/hub/start-ai-interview/route.ts`, update the import:

```typescript
import { createInterviewAgent, type CandidateLevel } from "@/lib/intervuebox/agents";
```

Update the `fitment_leads` select to also fetch `candidate_level`:

```typescript
const { data: lead, error: leadError } = await supabase
  .from("fitment_leads")
  .select("ib_job_id, ib_applied_job_id, candidate_level")
  .eq("user_id", user.id)
  .eq("role_title", roleTitle)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

Update the `createInterviewAgent` call site, inside the existing `try` block:

```typescript
let candidateId: string;
let ibAgentId: string;
try {
  ({ candidateId } = await getApplicant(lead.ib_applied_job_id));
  const candidateLevel = (lead.candidate_level as CandidateLevel) || "mid";
  ({ ibAgentId } = await createInterviewAgent(lead.ib_job_id, roleTitle, candidateLevel));
  const { invited } = await sendInterviewInvitation(ibAgentId, [candidateId]);
```

(the rest of the `try` block, and the rest of the file, are unchanged - only the import, the `select` string, and these three lines inside the `try` block change).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- start-ai-interview`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS across every test file - confirms Tasks 2, 3, 5, 6 didn't break each other or any other consumer of `createInterviewAgent`/`fitment_leads`.

- [ ] **Step 6: Commit**

```bash
git add app/api/hub/start-ai-interview/route.ts app/api/hub/start-ai-interview/__tests__/route.test.ts
git commit -m "feat(hub): pass candidate_level through to interview duration"
```

---

## Self-Review Notes

- **Spec coverage:** migration (Task 1), duration mapping in `agents.ts` (Task 2), form capture + storage (Tasks 3-4), `rescore-role` forwarding (Task 5), `start-ai-interview` wiring (Task 6) - all spec sections covered. Complexity is explicitly out of scope per the spec and this plan adds no code for it.
- **Type consistency:** `CandidateLevel = "entry" | "mid" | "senior"` is defined once in `lib/intervuebox/agents.ts` and imported by Task 6; Task 3's route defines its own local runtime validator (`isCandidateLevel`) since it doesn't otherwise depend on `lib/intervuebox/agents.ts` - both lists of literal values must stay `entry|mid|senior` if either changes.
- **No placeholders:** every step has complete code, exact file paths, and exact `npm test` invocations.
