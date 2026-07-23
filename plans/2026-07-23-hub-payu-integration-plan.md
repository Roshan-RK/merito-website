# PayU Payment Infra — Plan 1: Shared Infra + Report Re-scoping

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared PayU payment rail (hash/hosted-checkout client, transactions table, bypass flag, generic verify-and-finalize logic, webhook + browser-return routes) and re-scope the existing detailed-report paywall from per-role to per-lead, so a new JD/CV submission always re-locks the report — all gated by `PAYU_BYPASS` defaulting ON, so behavior is unchanged until the flag flips off.

**Architecture:** `lib/payu/client.ts` builds/verifies PayU's SHA-512 hosted-checkout hashes. `lib/payu/finalize.ts` is the single place that verifies a PayU callback and applies its effect — called by both `app/api/webhooks/payu/route.ts` (server-to-server) and `app/hub/payu/return/route.ts` (browser redirect back). `POST /api/hub/unlock-report` (existing route) is rewritten to key off `leadId` instead of `roleTitle`, and to either bypass-unlock instantly or create a pending `payu_transactions` row and hand back a PayU redirect form.

**Tech Stack:** Next.js App Router route handlers, Supabase (Postgres + RLS), Node's built-in `crypto` (SHA-512, no new dependency), Vitest.

**See also:** `specs/2026-07-23-hub-payu-integration-design.md` — full pricing table, all 5 products, and why this is split into 5 plans. This is Plan 1 of 5; only the **report** product goes live here. Personality/references/interview/bundle/counselling are follow-up plans that extend `lib/payu/pricing.ts`'s product union and add their own routes on top of this same rail.

## Global Constraints

- Node's built-in `crypto` and `fetch` only — no new dependency.
- `PAYU_BYPASS` must default to bypassed: read as `process.env.PAYU_BYPASS !== "false"`, never `=== "true"`.
- Every new route handler touching `crypto` or Supabase declares `export const runtime = "nodejs";`.
- Route/lib test mocking mirrors the existing pattern exactly: `vi.mock` the module, manually stub each chained Supabase method, dynamically `import("../route")` inside each test after mocks are set (see `app/api/hub/unlock-report/__tests__/route.test.ts`, `lib/__tests__/reportUnlocks.test.ts`).
- `candidate_level` is `'entry' | 'mid' | 'senior'` everywhere — same three string literals, no aliases.
- Report unlocks are keyed by `(user_id, lead_id)`, not `(user_id, role_title)` — a second JD/CV submission for the same role title is a fresh `fitment_leads` row with its own `id`, and therefore its own, separately-locked report.

---

### Task 1: Migration — `candidate_level`, `payu_transactions`, re-key `report_unlocks`

**Files:**
- Create: `supabase/migrations/0012_payu_infra.sql`

**Interfaces:**
- Produces: `fitment_leads.candidate_level` column; `payu_transactions(txnid, user_id, product, level, lead_id, amount_paise, status, consumed_at, created_at)`; `report_unlocks` re-keyed to `(user_id, lead_id)`. Every later task's Supabase calls reference these exact names.

- [ ] **Step 1: Write the migration**

```sql
create type payu_product as enum ('report', 'personality', 'references', 'interview', 'counselling', 'bundle');
create type candidate_level as enum ('entry', 'mid', 'senior');

alter table fitment_leads
  add column if not exists candidate_level candidate_level;

-- Re-key report_unlocks from (user_id, role_title) to (user_id, lead_id).
-- Existing rows are backfilled to their most recent matching lead at the
-- time of this migration — an approximation, but the closest available
-- fact (there's no stored link from an old unlock row to the specific
-- lead it was unlocked for, since the old schema never tracked one).
alter table report_unlocks
  add column if not exists lead_id uuid references fitment_leads(id);

update report_unlocks ru
set lead_id = (
  select fl.id
  from fitment_leads fl
  where fl.user_id = ru.user_id and fl.role_title = ru.role_title
  order by fl.created_at desc
  limit 1
)
where lead_id is null;

delete from report_unlocks where lead_id is null;

alter table report_unlocks alter column lead_id set not null;
alter table report_unlocks drop constraint report_unlocks_pkey;
alter table report_unlocks add primary key (user_id, lead_id);

create table if not exists payu_transactions (
  txnid text primary key,
  user_id uuid not null references auth.users(id),
  product payu_product not null,
  level candidate_level not null,
  lead_id uuid references fitment_leads(id),
  amount_paise integer not null,
  status text not null default 'initiated' check (status in ('initiated', 'success', 'failed')),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table payu_transactions enable row level security;

drop policy if exists "Users can view their own payu transactions" on payu_transactions;

create policy "Users can view their own payu transactions"
  on payu_transactions
  for select
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: applies with no errors; `payu_transactions` visible in the Supabase dashboard; `report_unlocks` now has a `lead_id` column and its primary key is `(user_id, lead_id)`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0012_payu_infra.sql
git commit -m "feat(payu): add payu_transactions, candidate_level, re-key report_unlocks to lead_id"
```

---

### Task 2: `lib/payu/pricing.ts` — level-aware pricing config

**Files:**
- Create: `lib/payu/pricing.ts`

**Interfaces:**
- Produces: `type PayuProduct = "report" | "personality" | "references" | "interview" | "counselling" | "bundle"`, `type CandidateLevel = "entry" | "mid" | "senior"`, `PRODUCT_PRICING: Record<PayuProduct, Record<CandidateLevel, number>>` (paise), `PRODUCT_LABELS: Record<PayuProduct, string>`, `formatPrice(paise: number): string`, `DEFAULT_LEVEL: CandidateLevel = "entry"`. Later tasks import `PayuProduct`/`CandidateLevel` as the source of truth; only `report`'s prices are exercised this phase.

- [ ] **Step 1: Write the config**

```ts
export type CandidateLevel = "entry" | "mid" | "senior";
export type PayuProduct = "report" | "personality" | "references" | "interview" | "counselling" | "bundle";

export const DEFAULT_LEVEL: CandidateLevel = "entry";

// Personality's "bundle rate" (charged only when bought as part of the
// report+personality+references bundle) lives in PRODUCT_PRICING.bundle,
// not here — this table is each product's own solo price.
export const PRODUCT_PRICING: Record<PayuProduct, Record<CandidateLevel, number>> = {
  report: { entry: 29900, mid: 29900, senior: 29900 },
  personality: { entry: 34900, mid: 99900, senior: 149900 },
  references: { entry: 29900, mid: 49900, senior: 49900 },
  interview: { entry: 99900, mid: 99900, senior: 149900 },
  counselling: { entry: 199900, mid: 199900, senior: 299900 },
  // report + personality(bundle rate) + references, per level:
  // entry 299+299+299=897, mid 299+499+499=1297, senior 299+999+499=1797
  bundle: { entry: 89700, mid: 129700, senior: 179700 },
};

export const PRODUCT_LABELS: Record<PayuProduct, string> = {
  report: "Detailed Report",
  personality: "Personality Test",
  references: "Reference Checks",
  interview: "Mock AI Interview",
  counselling: "1:1 Counselling Session",
  bundle: "Full Profile Bundle",
};

export function formatPrice(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/payu/pricing.ts
git commit -m "feat(payu): add level-aware product pricing config"
```

---

### Task 3: `lib/payu/client.ts` — PayU hash + hosted-checkout form builder

**Files:**
- Create: `lib/payu/client.ts`
- Test: `lib/payu/__tests__/client.test.ts`

**Interfaces:**
- Consumes: env vars `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`, `PAYU_BASE_URL`.
- Produces: `buildRequestHash(params: PayuPaymentParams): string`, `buildPaymentForm(params: PayuPaymentParams): { action: string; fields: Record<string, string> }`, `verifyResponseHash(fields: PayuResponseFields): boolean`. `PayuPaymentParams = { txnid, amount, productinfo, firstname, email, surl, furl }` (all `string`). `PayuResponseFields = { key, txnid, amount, productinfo, firstname, email, status, hash }` (all `string`). Task 6 (`finalize.ts`) and Task 7 (`unlock-report` route) import these directly.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/payu/__tests__/client.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";

beforeEach(() => {
  process.env.PAYU_MERCHANT_KEY = "testkey";
  process.env.PAYU_MERCHANT_SALT = "testsalt";
  process.env.PAYU_BASE_URL = "https://test.payu.in";
});

const baseParams = {
  txnid: "txn123",
  amount: "299.00",
  productinfo: "Detailed Report",
  firstname: "Rushi",
  email: "rushi@example.com",
  surl: "https://example.com/s",
  furl: "https://example.com/f",
};

describe("buildRequestHash", () => {
  it("matches PayU's documented key|txnid|amount|productinfo|firstname|email|udf1..udf10|salt formula", async () => {
    const { buildRequestHash } = await import("../client");
    // Independently built expected string — verified separately against
    // node's crypto module that this pipe layout (10 empty udf slots
    // between email and salt) matches PayU's documented formula exactly.
    const expectedString =
      "testkey|txn123|299.00|Detailed Report|Rushi|rushi@example.com|||||||||||testsalt";
    const expected = crypto.createHash("sha512").update(expectedString).digest("hex");
    expect(buildRequestHash(baseParams)).toBe(expected);
  });

  it("throws when PAYU_MERCHANT_KEY is missing", async () => {
    delete process.env.PAYU_MERCHANT_KEY;
    const { buildRequestHash } = await import("../client");
    expect(() => buildRequestHash(baseParams)).toThrow("PayU is not configured (PAYU_MERCHANT_KEY missing).");
  });
});

describe("buildPaymentForm", () => {
  it("returns the hosted-checkout action URL and all required fields", async () => {
    const { buildPaymentForm } = await import("../client");
    const form = buildPaymentForm(baseParams);
    expect(form.action).toBe("https://test.payu.in/_payment");
    expect(form.fields.key).toBe("testkey");
    expect(form.fields.txnid).toBe("txn123");
    expect(form.fields.amount).toBe("299.00");
    expect(form.fields.surl).toBe("https://example.com/s");
    expect(form.fields.furl).toBe("https://example.com/f");
    expect(form.fields.hash).toHaveLength(128);
  });
});

describe("verifyResponseHash", () => {
  const responseFields = {
    key: "testkey",
    txnid: "txn123",
    amount: "299.00",
    productinfo: "Detailed Report",
    firstname: "Rushi",
    email: "rushi@example.com",
    status: "success",
  };

  it("accepts a hash built with PayU's documented reverse formula", async () => {
    const { verifyResponseHash } = await import("../client");
    const expectedString =
      "testsalt|success|||||||||||rushi@example.com|Rushi|Detailed Report|299.00|txn123|testkey";
    const hash = crypto.createHash("sha512").update(expectedString).digest("hex");
    expect(verifyResponseHash({ ...responseFields, hash })).toBe(true);
  });

  it("rejects a tampered hash", async () => {
    const { verifyResponseHash } = await import("../client");
    expect(verifyResponseHash({ ...responseFields, hash: "deadbeef" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/payu/__tests__/client.test.ts`
Expected: FAIL — `Cannot find module '../client'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/payu/client.ts
import crypto from "crypto";

function requireEnv(name: "PAYU_MERCHANT_KEY" | "PAYU_MERCHANT_SALT" | "PAYU_BASE_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`PayU is not configured (${name} missing).`);
  }
  return value;
}

export type PayuPaymentParams = {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  surl: string;
  furl: string;
};

export function buildRequestHash(params: PayuPaymentParams): string {
  const key = requireEnv("PAYU_MERCHANT_KEY");
  const salt = requireEnv("PAYU_MERCHANT_SALT");
  const fields = [
    key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    ...Array(10).fill(""), // udf1-udf10, unused
  ];
  return crypto.createHash("sha512").update(`${fields.join("|")}|${salt}`).digest("hex");
}

export type PayuPaymentForm = {
  action: string;
  fields: Record<string, string>;
};

export function buildPaymentForm(params: PayuPaymentParams): PayuPaymentForm {
  const key = requireEnv("PAYU_MERCHANT_KEY");
  const baseUrl = requireEnv("PAYU_BASE_URL").replace(/\/$/, "");
  const hash = buildRequestHash(params);
  return {
    action: `${baseUrl}/_payment`,
    fields: {
      key,
      txnid: params.txnid,
      amount: params.amount,
      productinfo: params.productinfo,
      firstname: params.firstname,
      email: params.email,
      surl: params.surl,
      furl: params.furl,
      hash,
    },
  };
}

export type PayuResponseFields = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  hash: string;
};

export function verifyResponseHash(fields: PayuResponseFields): boolean {
  const salt = requireEnv("PAYU_MERCHANT_SALT");
  const reverseFields = [
    salt,
    fields.status,
    ...Array(10).fill(""), // udf10-udf1, unused
    fields.email,
    fields.firstname,
    fields.productinfo,
    fields.amount,
    fields.txnid,
    fields.key,
  ];
  const expected = crypto.createHash("sha512").update(reverseFields.join("|")).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(fields.hash, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/payu/__tests__/client.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/payu/client.ts lib/payu/__tests__/client.test.ts
git commit -m "feat(payu): add PayU hash + hosted-checkout form builder"
```

---

### Task 4: `candidate_level` on the fitment-check form

**Files:**
- Modify: `app/hub/FitmentChecker.tsx`
- Modify: `app/hub/account/ChangeRoleModal.tsx`
- Modify: `app/api/hub/fitment-check/route.ts`
- Modify: `app/api/hub/fitment-check/__tests__/route.test.ts`

**Interfaces:**
- Produces: `fitment_leads.candidate_level` is populated on every new submission (both the anonymous check and the authenticated re-check). Task 1's migration column is now written to, not just present.

- [ ] **Step 1: Write the failing test**

Add to `app/api/hub/fitment-check/__tests__/route.test.ts`, after the existing "returns 200 ready..." test:

```ts
it("returns 400 when candidateLevel is missing", async () => {
  const { POST } = await importRoute();
  const request = new Request("http://localhost/api/hub/fitment-check", {
    method: "POST",
    body: buildForm({ candidateLevel: "" }),
  });
  const response = await POST(request);
  expect(response.status).toBe(400);
});

it("returns 400 when candidateLevel isn't one of entry/mid/senior", async () => {
  const { POST } = await importRoute();
  const request = new Request("http://localhost/api/hub/fitment-check", {
    method: "POST",
    body: buildForm({ candidateLevel: "expert" }),
  });
  const response = await POST(request);
  expect(response.status).toBe(400);
});

it("saves candidateLevel on the inserted lead", async () => {
  const { POST } = await importRoute();
  const request = new Request("http://localhost/api/hub/fitment-check", {
    method: "POST",
    body: buildForm({ candidateLevel: "senior" }),
  });
  await POST(request);
  expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ candidate_level: "senior" }));
});
```

Update `buildForm`'s defaults (`route.test.ts:45-58`) to include `form.set("candidateLevel", "mid");` alongside the other defaults, so every pre-existing test (which doesn't care about level) keeps passing unchanged.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run app/api/hub/fitment-check/__tests__/route.test.ts`
Expected: the 3 new tests FAIL (no `candidateLevel` handling yet); pre-existing tests still PASS once `buildForm`'s default is added.

- [ ] **Step 3: Validate and store `candidateLevel` in the route**

In `app/api/hub/fitment-check/route.ts`, add near the other `normalize()` calls (`route.ts:129-136`):

```ts
const candidateLevel = normalize(form.get("candidateLevel"));
```

Add validation alongside the other required-field checks (`route.ts:141-143`):

```ts
if (candidateLevel !== "entry" && candidateLevel !== "mid" && candidateLevel !== "senior") {
  return Response.json({ error: "Select your experience level." }, { status: 400 });
}
```

Add to the `fitment_leads` insert payload (`route.ts:225-249`), alongside `role_title`:

```ts
candidate_level: candidateLevel,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/hub/fitment-check/__tests__/route.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Add the dropdown to `FitmentChecker.tsx`**

Add state near the other fields (`FitmentChecker.tsx:24`):

```ts
const [candidateLevel, setCandidateLevel] = useState<"" | "entry" | "mid" | "senior">("");
```

Add to `canSubmit` (`FitmentChecker.tsx:70`):

```ts
const canSubmit = email.trim() && role.trim() && phone.trim() && candidateLevel && (jdMode === "paste" ? jdText.trim() : jdUrl.trim()) && cvFile && !checking;
```

Add to the submit `FormData` (`FitmentChecker.tsx:101-108`, alongside `form.set("role", role.trim());`):

```ts
form.set("candidateLevel", candidateLevel);
```

Add the dropdown JSX near the role input:

```tsx
<select
  value={candidateLevel}
  onChange={(e) => setCandidateLevel(e.target.value as "entry" | "mid" | "senior")}
  className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24]"
  style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
>
  <option value="" disabled>
    Your experience level
  </option>
  <option value="entry">Entry-level (0-2 years)</option>
  <option value="mid">Mid-level (3-7 years)</option>
  <option value="senior">Senior-level (8+ years)</option>
</select>
```

- [ ] **Step 6: Add the same dropdown to `ChangeRoleModal.tsx`**

Add state (`ChangeRoleModal.tsx:16`):

```ts
const [candidateLevel, setCandidateLevel] = useState<"" | "entry" | "mid" | "senior">("");
```

Add to `canSubmit` (`ChangeRoleModal.tsx:25`):

```ts
const canSubmit = role.trim() && candidateLevel && (jdMode === "paste" ? jdText.trim() : jdUrl.trim()) && cvFile && !busy;
```

Add to the submit `FormData` (`ChangeRoleModal.tsx:32-37`, alongside `form.set("role", role.trim());`):

```ts
form.set("candidateLevel", candidateLevel);
```

Add the same `<select>` block as Step 5, placed right after the role `<input>` (`ChangeRoleModal.tsx:79`).

- [ ] **Step 7: Commit**

```bash
git add app/hub/FitmentChecker.tsx app/hub/account/ChangeRoleModal.tsx app/api/hub/fitment-check/route.ts app/api/hub/fitment-check/__tests__/route.test.ts
git commit -m "feat(payu): collect candidate_level on the fitment-check form"
```

---

### Task 5: Re-scope `lib/reportUnlocks.ts` from `role_title` to `leadId`

**Files:**
- Modify: `lib/reportUnlocks.ts`
- Modify: `lib/__tests__/reportUnlocks.test.ts`

**Interfaces:**
- Produces: `unlockReport(userId: string, leadId: string): Promise<void>`, `isReportUnlocked(userId: string, leadId: string): Promise<boolean>` — same function names, `leadId` replaces `roleTitle` as the second parameter and the `report_unlocks` row's second key column. Tasks 6, 7, and the `app/hub/account/page.tsx` call site all use this new signature.

- [ ] **Step 1: Update the failing tests**

Replace every `"Senior Product Manager"` argument in `lib/__tests__/reportUnlocks.test.ts` with `"lead-1"`, and every `role_title` key in the assertion objects with `lead_id`. E.g. (`reportUnlocks.test.ts:32-38`):

```ts
it("upserts a report_unlocks row keyed on user_id + lead_id", async () => {
  fromMock.mockReturnValue({ upsert: upsertMock });
  upsertMock.mockResolvedValue({ error: null });
  const { unlockReport } = await import("../reportUnlocks");

  await unlockReport("user-123", "lead-1");

  expect(fromMock).toHaveBeenCalledWith("report_unlocks");
  expect(upsertMock).toHaveBeenCalledWith(
    { user_id: "user-123", lead_id: "lead-1" },
    { onConflict: "user_id,lead_id" }
  );
});
```

Apply the same `lead_id`/`"lead-1"` substitution to every other test in the file (`unlockReport` idempotency + error case, `isReportUnlocked` true/false/error cases, and their `eq("role_title", ...)` assertions become `eq("lead_id", "lead-1")`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/reportUnlocks.test.ts`
Expected: FAIL — implementation still upserts `role_title`.

- [ ] **Step 3: Update the implementation**

```ts
// lib/reportUnlocks.ts
import { getSupabaseServerClient } from "@/lib/supabase";

export async function unlockReport(userId: string, leadId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("report_unlocks")
    .upsert({ user_id: userId, lead_id: leadId }, { onConflict: "user_id,lead_id" });

  if (error) {
    throw new Error(`Failed to unlock report: ${error.message}`);
  }
}

export async function isReportUnlocked(userId: string, leadId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_unlocks")
    .select("user_id")
    .eq("user_id", userId)
    .eq("lead_id", leadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check report unlock status: ${error.message}`);
  }

  return Boolean(data);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/reportUnlocks.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/reportUnlocks.ts lib/__tests__/reportUnlocks.test.ts
git commit -m "feat(payu): re-scope report unlocks from role_title to lead_id"
```

---

### Task 6: `lib/payu/finalize.ts` — shared verify-and-unlock logic (report)

**Files:**
- Create: `lib/payu/finalize.ts`
- Test: `lib/payu/__tests__/finalize.test.ts`

**Interfaces:**
- Consumes: `verifyResponseHash`, `PayuResponseFields` from `lib/payu/client.ts` (Task 3); `unlockReport` from `lib/reportUnlocks.ts` (Task 5); `getSupabaseServerClient` from `lib/supabase.ts`; `payu_transactions` table (Task 1).
- Produces: `finalizePaymentFromPayu(fields: PayuResponseFields): Promise<FinalizeResult>` where `FinalizeResult = { ok: true; product: PayuProduct; userId: string; leadId: string | null } | { ok: false; reason: "invalid_hash" | "unknown_txn" | "payment_failed" | "unsupported_product" }`. Only `product === "report"` is handled this phase — any other stored product value returns `unsupported_product` (later plans extend this `switch`). Tasks 8 (webhook) and 9 (return route) both call this exact function.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/payu/__tests__/finalize.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyResponseHashMock = vi.fn();
vi.mock("@/lib/payu/client", () => ({
  verifyResponseHash: verifyResponseHashMock,
}));

const unlockReportMock = vi.fn();
vi.mock("@/lib/reportUnlocks", () => ({
  unlockReport: unlockReportMock,
}));

const txnSelectMock = vi.fn();
const txnEqMock = vi.fn();
const txnMaybeSingleMock = vi.fn();
const updateMock = vi.fn();
const updateEqMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

function buildFields(overrides: Partial<Record<string, string>> = {}) {
  return {
    key: "testkey",
    txnid: "txn-1",
    amount: "299.00",
    productinfo: "Detailed Report",
    firstname: "Rushi",
    email: "rushi@example.com",
    status: "success",
    hash: "somehash",
    ...overrides,
  };
}

describe("finalizePaymentFromPayu", () => {
  beforeEach(() => {
    verifyResponseHashMock.mockReset();
    unlockReportMock.mockReset();
    unlockReportMock.mockResolvedValue(undefined);
    fromMock.mockReset();
    txnSelectMock.mockReset();
    txnEqMock.mockReset();
    txnMaybeSingleMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();
    updateEqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: updateEqMock });
    fromMock.mockReturnValue({ select: txnSelectMock, update: updateMock });
    txnSelectMock.mockReturnValue({ eq: txnEqMock });
    txnEqMock.mockReturnValue({ maybeSingle: txnMaybeSingleMock });
  });

  it("rejects with invalid_hash when the hash doesn't verify, without touching Supabase", async () => {
    verifyResponseHashMock.mockReturnValue(false);
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields());

    expect(result).toEqual({ ok: false, reason: "invalid_hash" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects with unknown_txn when no payu_transactions row matches", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    txnMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields());

    expect(result).toEqual({ ok: false, reason: "unknown_txn" });
    expect(unlockReportMock).not.toHaveBeenCalled();
  });

  it("marks the transaction failed and rejects with payment_failed on a non-success status", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "report", lead_id: "lead-1", status: "initiated" },
      error: null,
    });
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields({ status: "failure" }));

    expect(result).toEqual({ ok: false, reason: "payment_failed" });
    expect(updateMock).toHaveBeenCalledWith({ status: "failed" });
    expect(updateEqMock).toHaveBeenCalledWith("txnid", "txn-1");
    expect(unlockReportMock).not.toHaveBeenCalled();
  });

  it("unlocks the report and marks the transaction success on first success", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "report", lead_id: "lead-1", status: "initiated" },
      error: null,
    });
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields());

    expect(result).toEqual({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
    expect(updateMock).toHaveBeenCalledWith({ status: "success" });
    expect(unlockReportMock).toHaveBeenCalledWith("user-1", "lead-1");
  });

  it("is idempotent — a second success callback doesn't call unlockReport again", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "report", lead_id: "lead-1", status: "success" },
      error: null,
    });
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields());

    expect(result).toEqual({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
    expect(unlockReportMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects with unsupported_product for any product other than report", async () => {
    verifyResponseHashMock.mockReturnValue(true);
    txnMaybeSingleMock.mockResolvedValue({
      data: { user_id: "user-1", product: "personality", lead_id: null, status: "initiated" },
      error: null,
    });
    const { finalizePaymentFromPayu } = await import("../finalize");

    const result = await finalizePaymentFromPayu(buildFields());

    expect(result).toEqual({ ok: false, reason: "unsupported_product" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/payu/__tests__/finalize.test.ts`
Expected: FAIL — `Cannot find module '../finalize'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/payu/finalize.ts
import { getSupabaseServerClient } from "@/lib/supabase";
import { verifyResponseHash, type PayuResponseFields } from "@/lib/payu/client";
import { unlockReport } from "@/lib/reportUnlocks";
import type { PayuProduct } from "@/lib/payu/pricing";

export type FinalizeResult =
  | { ok: true; product: PayuProduct; userId: string; leadId: string | null }
  | { ok: false; reason: "invalid_hash" | "unknown_txn" | "payment_failed" | "unsupported_product" };

export async function finalizePaymentFromPayu(fields: PayuResponseFields): Promise<FinalizeResult> {
  if (!verifyResponseHash(fields)) {
    return { ok: false, reason: "invalid_hash" };
  }

  const supabase = getSupabaseServerClient();
  const { data: txn, error } = await supabase
    .from("payu_transactions")
    .select("user_id, product, lead_id, status")
    .eq("txnid", fields.txnid)
    .maybeSingle();

  if (error || !txn) {
    return { ok: false, reason: "unknown_txn" };
  }

  if (fields.status !== "success") {
    if (txn.status === "initiated") {
      await supabase.from("payu_transactions").update({ status: "failed" }).eq("txnid", fields.txnid);
    }
    return { ok: false, reason: "payment_failed" };
  }

  const product = txn.product as PayuProduct;

  // Only "report" is wired up this phase — personality/references/interview/
  // counselling/bundle each get their own case in a later plan.
  if (product !== "report") {
    return { ok: false, reason: "unsupported_product" };
  }

  if (txn.status !== "success") {
    await supabase.from("payu_transactions").update({ status: "success" }).eq("txnid", fields.txnid);
    await unlockReport(txn.user_id, txn.lead_id as string);
  }

  return { ok: true, product, userId: txn.user_id, leadId: txn.lead_id };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/payu/__tests__/finalize.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/payu/finalize.ts lib/payu/__tests__/finalize.test.ts
git commit -m "feat(payu): add shared verify-and-unlock finalize logic"
```

---

### Task 7: Rewrite `POST /api/hub/unlock-report` for `leadId` + real PayU

**Files:**
- Modify: `app/api/hub/unlock-report/route.ts`
- Modify: `app/api/hub/unlock-report/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `unlockReport` from `lib/reportUnlocks.ts` (Task 5, new signature); `buildPaymentForm` from `lib/payu/client.ts` (Task 3); `PRODUCT_PRICING`, `PRODUCT_LABELS`, `DEFAULT_LEVEL` from `lib/payu/pricing.ts` (Task 2); `getSupabaseServerClient` from `lib/supabase.ts`; `siteUrl` from `lib/site.ts`.
- Produces: request body becomes `{ leadId: string }` (was `{ roleTitle: string }`). Bypass response unchanged shape (`{ status: "unlocked", report }` / `{ status: "pending" }`). New live-mode response: `{ status: "redirect", form: { action, fields } }`. Task 10 updates `ReportPaywallModal` to send `leadId` and handle this new response shape.

- [ ] **Step 1: Rewrite the tests for `leadId`**

Replace every `body: JSON.stringify({ roleTitle: "Senior Product Manager" })` in `app/api/hub/unlock-report/__tests__/route.test.ts` with `body: JSON.stringify({ leadId: "lead-1" })`, and change `buildLeadChain`'s query-chain assertions from a two-`.eq()` lookup (`user_id` + `role_title`, ordered/limited) to a single-row-by-id lookup. Replace `buildLeadChain` (`route.test.ts:37-45`) with:

```ts
function buildLeadChain(result: { data: unknown; error: unknown }) {
  sessionFromMock.mockReturnValue({ select: leadSelectMock });
  leadSelectMock.mockReturnValue({ eq: leadEq1Mock });
  leadEq1Mock.mockReturnValue({ eq: leadEq2Mock });
  leadEq2Mock.mockReturnValue({ maybeSingle: leadMaybeSingleMock });
  leadMaybeSingleMock.mockResolvedValue(result);
}
```

(Drop the `leadOrderMock`/`leadLimitMock` chain — a lookup by primary-key `id` needs no ordering — and remove those two `vi.fn()` declarations and their `mockReset()` calls.)

Update every `unlockReportMock` assertion, e.g. (`route.test.ts:123`):

```ts
expect(unlockReportMock).toHaveBeenCalledWith("user-123", "lead-1");
```

Add a new test after the existing 400 "no matching row" test:

```ts
it("returns 400 when the lead doesn't belong to this user", async () => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
  buildLeadChain({ data: null, error: null });
  const { POST } = await importRoute();
  const request = new Request("http://localhost/api/hub/unlock-report", {
    method: "POST",
    body: JSON.stringify({ leadId: "someone-elses-lead" }),
  });
  const response = await POST(request);
  expect(response.status).toBe(400);
  expect(leadEq1Mock).toHaveBeenCalledWith("user_id", "user-123");
  expect(leadEq2Mock).toHaveBeenCalledWith("id", "someone-elses-lead");
});
```

Add a new `describe` block for the live (non-bypass) path:

```ts
describe("live PayU path (PAYU_BYPASS=false)", () => {
  beforeEach(() => {
    process.env.PAYU_BYPASS = "false";
    process.env.PAYU_MERCHANT_KEY = "testkey";
  });

  afterEach(() => {
    delete process.env.PAYU_BYPASS;
    delete process.env.PAYU_MERCHANT_KEY;
  });

  it("creates a pending payu_transactions row and returns a redirect form instead of unlocking", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123", email: "rushi@example.com" } } });
    buildLeadChain({
      data: { id: "lead-1", role_title: "Senior Product Manager", candidate_level: "mid", ib_applied_job_id: "APJ_1", resume_match_status: "READY", resume_match_raw: {} },
      error: null,
    });
    insertMock.mockResolvedValue({ error: null });

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ leadId: "lead-1" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("redirect");
    expect(body.form.action).toContain("_payment");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-123", product: "report", lead_id: "lead-1", level: "mid", status: "initiated" })
    );
    expect(unlockReportMock).not.toHaveBeenCalled();
  });
});
```

This needs `insertMock` wired to the admin client's `insert`, alongside the existing `updateMock`/`updateEqMock` (`route.test.ts:15-17`):

```ts
const insertMock = vi.fn();
```

and in `beforeEach` (alongside the other `adminFromMock.mockReturnValue`):

```ts
insertMock.mockReset();
insertMock.mockResolvedValue({ error: null });
adminFromMock.mockReturnValue({ update: updateMock, insert: insertMock });
```

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `npx vitest run app/api/hub/unlock-report/__tests__/route.test.ts`
Expected: FAIL — route still reads `roleTitle` and always bypasses.

- [ ] **Step 3: Rewrite the route**

```ts
// app/api/hub/unlock-report/route.ts
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { unlockReport } from "@/lib/reportUnlocks";
import { getResumeMatchReport, scoreOutOfTen } from "@/lib/intervuebox/reports";
import { getSupabaseServerClient } from "@/lib/supabase";
import { buildPaymentForm } from "@/lib/payu/client";
import { PRODUCT_PRICING, PRODUCT_LABELS, DEFAULT_LEVEL, type CandidateLevel } from "@/lib/payu/pricing";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

function isPayuBypassed(): boolean {
  return process.env.PAYU_BYPASS !== "false";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { leadId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  if (!leadId) {
    return Response.json({ error: "leadId is required." }, { status: 400 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("id, ib_applied_job_id, resume_match_status, resume_match_raw, candidate_level")
    .eq("user_id", user.id)
    .eq("id", leadId)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ error: "No fitment check found for this lead." }, { status: 400 });
  }

  if (!isPayuBypassed()) {
    const level = (lead.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;
    const amountPaise = PRODUCT_PRICING.report[level];
    const txnid = crypto.randomUUID();

    const admin = getSupabaseServerClient();
    const { error: insertError } = await admin.from("payu_transactions").insert({
      txnid,
      user_id: user.id,
      product: "report",
      level,
      lead_id: leadId,
      amount_paise: amountPaise,
      status: "initiated",
    });

    if (insertError) {
      return Response.json({ error: "Something went wrong starting payment." }, { status: 500 });
    }

    const form = buildPaymentForm({
      txnid,
      amount: (amountPaise / 100).toFixed(2),
      productinfo: PRODUCT_LABELS.report,
      firstname: user.email?.split("@")[0] || "Candidate",
      email: user.email ?? "",
      surl: `${siteUrl}/hub/payu/return`,
      furl: `${siteUrl}/hub/payu/return`,
    });

    return Response.json({ status: "redirect", form });
  }

  try {
    await unlockReport(user.id, leadId);
  } catch {
    return Response.json({ error: "Something went wrong unlocking the report." }, { status: 500 });
  }

  if (lead.resume_match_status === "READY") {
    return Response.json({ status: "unlocked", report: lead.resume_match_raw });
  }

  let report;
  try {
    report = await getResumeMatchReport(lead.ib_applied_job_id);
  } catch {
    return Response.json({ error: "Unlocked, but the report failed to load — please refresh." }, { status: 500 });
  }

  if (report.status === "PENDING") {
    return Response.json({ status: "pending" });
  }

  const resumeMatchRaw = {
    overallScore: report.overallScore,
    rank: report.rank,
    categories: report.categories,
    summary: report.summary,
    strongPoints: report.strongPoints,
    weakPoints: report.weakPoints,
  };

  const admin = getSupabaseServerClient();
  const { error: updateError } = await admin
    .from("fitment_leads")
    .update({
      score: scoreOutOfTen(report.overallScore),
      verdict: report.summary,
      resume_match_status: "READY",
      resume_match_score: report.overallScore,
      resume_match_raw: resumeMatchRaw,
    })
    .eq("id", lead.id);

  if (updateError) {
    return Response.json({ error: "Unlocked, but the report failed to save — please refresh." }, { status: 500 });
  }

  return Response.json({ status: "unlocked", report: resumeMatchRaw });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/hub/unlock-report/__tests__/route.test.ts`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/unlock-report/route.ts app/api/hub/unlock-report/__tests__/route.test.ts
git commit -m "feat(payu): rewrite unlock-report for lead_id + real PayU checkout"
```

---

### Task 8: `POST /api/webhooks/payu` — server-to-server webhook

**Files:**
- Create: `app/api/webhooks/payu/route.ts`
- Test: `app/api/webhooks/payu/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `finalizePaymentFromPayu` from `lib/payu/finalize.ts` (Task 6).
- Produces: `POST` handler reading `x-www-form-urlencoded` body, always responds `{ received: true }` (PayU retries on non-2xx; finalize is idempotent, so nothing needs retrying towards).

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/webhooks/payu/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const finalizePaymentFromPayuMock = vi.fn();
vi.mock("@/lib/payu/finalize", () => ({
  finalizePaymentFromPayu: finalizePaymentFromPayuMock,
}));

async function importRoute() {
  return await import("../route");
}

function buildRequest(fields: Record<string, string>) {
  const params = new URLSearchParams(fields);
  return new Request("http://localhost/api/webhooks/payu", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

describe("POST /api/webhooks/payu", () => {
  beforeEach(() => {
    finalizePaymentFromPayuMock.mockReset();
    finalizePaymentFromPayuMock.mockResolvedValue({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
  });

  it("parses the form-encoded body and calls finalizePaymentFromPayu with all fields", async () => {
    const { POST } = await importRoute();
    const response = await POST(
      buildRequest({
        key: "testkey",
        txnid: "txn-1",
        amount: "299.00",
        productinfo: "Detailed Report",
        firstname: "Rushi",
        email: "rushi@example.com",
        status: "success",
        hash: "somehash",
      })
    );

    expect(finalizePaymentFromPayuMock).toHaveBeenCalledWith({
      key: "testkey",
      txnid: "txn-1",
      amount: "299.00",
      productinfo: "Detailed Report",
      firstname: "Rushi",
      email: "rushi@example.com",
      status: "success",
      hash: "somehash",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it("still returns 200 when finalize rejects the payload (no retry storm)", async () => {
    finalizePaymentFromPayuMock.mockResolvedValue({ ok: false, reason: "invalid_hash" });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ txnid: "txn-1", status: "success" }));
    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/webhooks/payu/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Write the implementation**

```ts
// app/api/webhooks/payu/route.ts
import { finalizePaymentFromPayu } from "@/lib/payu/finalize";
import type { PayuResponseFields } from "@/lib/payu/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  const fields: PayuResponseFields = {
    key: params.get("key") ?? "",
    txnid: params.get("txnid") ?? "",
    amount: params.get("amount") ?? "",
    productinfo: params.get("productinfo") ?? "",
    firstname: params.get("firstname") ?? "",
    email: params.get("email") ?? "",
    status: params.get("status") ?? "",
    hash: params.get("hash") ?? "",
  };

  await finalizePaymentFromPayu(fields);

  return Response.json({ received: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/webhooks/payu/__tests__/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/payu/route.ts app/api/webhooks/payu/__tests__/route.test.ts
git commit -m "feat(payu): add server-to-server webhook handler"
```

---

### Task 9: `POST /hub/payu/return` — browser return handler

**Files:**
- Create: `app/hub/payu/return/route.ts`
- Test: `app/hub/payu/return/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `finalizePaymentFromPayu` from `lib/payu/finalize.ts` (Task 6); `siteUrl` from `lib/site.ts`.
- Produces: `POST` handler that 303-redirects the browser to `/hub/account?payu=success` on success or `/hub/account?payu=failed` otherwise. (The dashboard page already reloads fresh unlock/report state from the DB on every load — no query param beyond a toast flag is needed.)

- [ ] **Step 1: Write the failing test**

```ts
// app/hub/payu/return/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const finalizePaymentFromPayuMock = vi.fn();
vi.mock("@/lib/payu/finalize", () => ({
  finalizePaymentFromPayu: finalizePaymentFromPayuMock,
}));

async function importRoute() {
  return await import("../route");
}

function buildRequest(fields: Record<string, string>) {
  const params = new URLSearchParams(fields);
  return new Request("http://localhost/hub/payu/return", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

describe("POST /hub/payu/return", () => {
  beforeEach(() => {
    finalizePaymentFromPayuMock.mockReset();
  });

  it("redirects to the dashboard with a success flag when finalize succeeds", async () => {
    finalizePaymentFromPayuMock.mockResolvedValue({ ok: true, product: "report", userId: "user-1", leadId: "lead-1" });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ txnid: "txn-1", status: "success" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://www.merito.ai/hub/account?payu=success");
  });

  it("redirects to the dashboard with a failed flag when finalize rejects", async () => {
    finalizePaymentFromPayuMock.mockResolvedValue({ ok: false, reason: "payment_failed" });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ txnid: "txn-1", status: "failure" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://www.merito.ai/hub/account?payu=failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/hub/payu/return/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Write the implementation**

```ts
// app/hub/payu/return/route.ts
import { finalizePaymentFromPayu } from "@/lib/payu/finalize";
import type { PayuResponseFields } from "@/lib/payu/client";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  const fields: PayuResponseFields = {
    key: params.get("key") ?? "",
    txnid: params.get("txnid") ?? "",
    amount: params.get("amount") ?? "",
    productinfo: params.get("productinfo") ?? "",
    firstname: params.get("firstname") ?? "",
    email: params.get("email") ?? "",
    status: params.get("status") ?? "",
    hash: params.get("hash") ?? "",
  };

  const result = await finalizePaymentFromPayu(fields);

  const destination = result.ok ? `${siteUrl}/hub/account?payu=success` : `${siteUrl}/hub/account?payu=failed`;

  return Response.redirect(destination, 303);
}
```

Note: `lib/site.ts:1` defaults `siteUrl` to `https://www.merito.ai` when `NEXT_PUBLIC_SITE_URL` is unset, matching the test's assertion.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/hub/payu/return/__tests__/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/hub/payu/return/route.ts app/hub/payu/return/__tests__/route.test.ts
git commit -m "feat(payu): add browser return handler"
```

---

### Task 10: Wire `leadId` through the dashboard UI

**Files:**
- Modify: `app/hub/account/page.tsx`
- Modify: `app/hub/account/DashboardClient.tsx`
- Modify: `app/hub/account/ReportPaywallModal.tsx`

**Interfaces:**
- Consumes: `POST /api/hub/unlock-report` (Task 7) with its new `{ leadId }` body / `{ status: "redirect", form }` response shape.
- Produces: `DashboardClient` gains a `leadId: string` prop; `ReportPaywallModal` gains a `leadId: string` prop (replacing its use of `roleTitle` for the API call — `roleTitle` stays as a prop, still used for display copy).

- [ ] **Step 1: Pass `leadId` from `page.tsx`**

Update `isReportUnlocked` call (`page.tsx:50`):

```ts
const reportUnlocked = await isReportUnlocked(user.id, current.id);
```

Add `leadId={current.id}` to the `<DashboardClient ... />` call (`page.tsx:123-133`).

- [ ] **Step 2: Thread `leadId` through `DashboardClient`**

Add `leadId: string;` to the props type (`DashboardClient.tsx:20-29`) and destructure it. Pass it to `ReportPaywallModal` (`DashboardClient.tsx:73-81`):

```tsx
{modal === "report" && (
  <ReportPaywallModal
    leadId={leadId}
    roleTitle={roleTitle}
    onClose={() => setModal("none")}
    onUnlocked={(unlockedReport) => {
      setReportUnlocked(true);
      setReport(unlockedReport);
      setModal("none");
    }}
  />
)}
```

- [ ] **Step 3: Update `ReportPaywallModal` for `leadId` + the redirect response**

Add `leadId: string;` to the props type (`ReportPaywallModal.tsx:6-14`). Replace the request body and add redirect handling in `handlePay` (`ReportPaywallModal.tsx:19-45`):

```tsx
const handlePay = async () => {
  setPaying(true);
  setError(null);
  try {
    const res = await fetch("/api/hub/unlock-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPaying(false);
      setError(data.error || "Something went wrong — please try again.");
      return;
    }
    if (data.status === "pending") {
      setPaying(false);
      setPending(true);
      return;
    }
    if (data.status === "redirect") {
      submitPayuForm(data.form);
      return;
    }
    setPaying(false);
    onUnlocked(data.report);
  } catch {
    setPaying(false);
    setError("Something went wrong — please try again.");
  }
};
```

Add the same hidden-form auto-submit helper used by the modal, above the component:

```tsx
function submitPayuForm(form: { action: string; fields: Record<string, string> }) {
  const formEl = document.createElement("form");
  formEl.method = "POST";
  formEl.action = form.action;
  for (const [name, value] of Object.entries(form.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    formEl.appendChild(input);
  }
  document.body.appendChild(formEl);
  formEl.submit();
}
```

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/page.tsx app/hub/account/DashboardClient.tsx app/hub/account/ReportPaywallModal.tsx
git commit -m "feat(payu): wire leadId through the report paywall UI"
```

(No component tests exist anywhere in this repo — `vitest.config.ts` only picks up `**/*.test.ts` — so this UI-wiring task has no test step, consistent with every other `.tsx` change in this codebase.)

---

### Task 11: Env vars

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the PayU block**

Add after the existing `INTERVUEBOX_*` lines (`.env.example:13`):

```
PAYU_MERCHANT_KEY=
PAYU_MERCHANT_SALT=
PAYU_BASE_URL=https://test.payu.in
PAYU_BYPASS=true
```

- [ ] **Step 2: Add real sandbox values to your own `.env.local`**

Manual, not committed — set `PAYU_MERCHANT_KEY`/`PAYU_MERCHANT_SALT` to the sandbox credentials already on hand, `PAYU_BASE_URL=https://test.payu.in`, leave `PAYU_BYPASS=true`.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(payu): document PayU env vars"
```

---

### Final check

- [ ] Run the full suite: `npm test` — expect all tests green, including every pre-existing test file this plan didn't touch.
- [ ] Manually verify with `PAYU_BYPASS` unset (defaults true): fitment-check now requires picking a level; report paywall behaves exactly as before otherwise.
- [ ] Manually verify: submit a fitment check, unlock its report, then use "Change target role" with the *same* role title and a new CV — confirm the new lead's report is locked again (fresh ₹ button), not already unlocked.
- [ ] Manually verify with `PAYU_BYPASS=false` and real sandbox credentials in `.env.local`: clicking "Unlock my report" redirects to PayU's sandbox hosted-checkout page; completing a test payment redirects back to `/hub/account?payu=success` with the report now unlocked.
