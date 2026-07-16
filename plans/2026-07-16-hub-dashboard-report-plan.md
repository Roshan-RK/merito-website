# Merito HUB Phase 2: Dashboard Shell & Detailed Report Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 1's bare `/hub/account` page with a real 3-pane dashboard (top bar, progress rail, score card, detailed-report paywall) and ship the detailed fitment report as the first real paid unlock — fake-charged this phase, real Razorpay integration deferred.

**Architecture:** `app/hub/account/page.tsx` becomes a Server Component shell that reads the session, the candidate's current target role (their most recent claimed `fitment_leads` row), report-unlock status, and any generated report, then renders Client Component islands (`TopBar`, `ProgressRail`, `ScoreCard`, `ReportPaywallModal`, `ChangeRoleModal`) for the interactive pieces. Unlocking writes a `report_unlocks` row instantly (no payment gateway) and lazily generates the detailed breakdown via a second Claude call, persisted in `fitment_reports` so it's never regenerated on a normal revisit.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4 (inline styles for exact design-token values, matching the existing `FitmentChecker.tsx`/`login/page.tsx` pattern), Supabase (Postgres + Auth via `@supabase/ssr`), Anthropic Claude Haiku 4.5 (structured output via `zodOutputFormat`), Vitest.

## Global Constraints

- Design tokens (from `design_handoff_merito_hub/dashboard/README.md`): primary red `#ed1a24` · hover `#c8151e` · red CTA shadow `0 4px 6px rgba(236,34,40,0.3)` · red tint bg `#fdeced` · blush page bg `#fdf8fb` · black `#0a0a0a` · body text `#4b4b4d` · hint text `#9c9c9c` · success `#16803c` on `#eefdf1` · borders `rgba(0,0,0,0.08)` · input border `#dcdcdc` (focus → red) · progress track `#f0e6ea` · card shadow `0 18px 50px rgba(17,35,89,0.05)` · radii: buttons/inputs 8px, cards 20-24px, modals 24px, pills 50px.
- Type: Gabarito for headings/scores (`font-[family-name:var(--font-gabarito)]`), Poppins for body/labels/buttons (`font-[family-name:var(--font-poppins)]`) — both already loaded globally in `app/layout.tsx`, no new font setup needed.
- Report pricing is fixed at ₹299, matching the design file exactly (no first-free carve-out) — copied verbatim into `ReportPaywallModal`.
- No real payment gateway this phase — the pay button in `ReportPaywallModal` calls `POST /api/hub/unlock-report` directly and treats any 200 response as a successful "purchase."
- `lib/supabaseAuth.ts` (browser-only) and `lib/supabaseAuthServer.ts` (server-only, uses `next/headers`) are already split from a Phase 1 bug fix — never recombine them. Client Components import `createSupabaseBrowserClient` from `@/lib/supabaseAuth`; Server Components and Route Handlers import `createSupabaseServerClient` from `@/lib/supabaseAuthServer`.
- The admin Supabase client (`getSupabaseServerClient` from `@/lib/supabase`, service-role key, bypasses RLS) is only ever used from trusted server-side code (Route Handlers, `lib/` modules never imported by client code) — never exposed to a client-callable path directly.
- New tables (`report_unlocks`, `fitment_reports`) get RLS enabled with a `SELECT` policy scoped to `auth.uid() = user_id`, matching the pattern already established on `fitment_leads` in migration `0002`. Every `CREATE POLICY` is preceded by `DROP POLICY IF EXISTS` for idempotency (a Phase 1 final-review fix, now the house style).
- No automated tests for dashboard UI components (`TopBar`, `ProgressRail`, `ScoreCard`, `ReportPaywallModal`, `ChangeRoleModal`, `app/privacy/page.tsx`) — this repo has no component/browser test infrastructure, matching Phase 0/1 precedent. `lib/generateFitmentReport.ts`, `lib/reportUnlocks.ts`, and `app/api/hub/unlock-report/route.ts` DO get real unit tests, mirroring the existing patterns in `lib/__tests__/scoreFitment.test.ts`, `lib/__tests__/claimFitmentLeads.test.ts`, and `app/hub/auth/callback/__tests__/route.test.ts` respectively.
- `vitest.config.ts` already has the `@/*` path alias configured in `resolve.alias` — do not touch it.
- Migrations are written to `supabase/migrations/` but NOT applied by any task — a human applies them via `psql` or the Supabase SQL Editor against the already-provisioned live project (same precedent as migrations `0001` and `0002`).
- Two design source files exist outside this repo and are the source of truth for exact copy, spacing, and interaction details beyond what's reproduced in this plan: `C:\Users\Growqai\Downloads\Merito HUB landing page (2)\design_handoff_merito_hub\dashboard\Merito HUB Dashboard.dc.html` (full working prototype) and its sibling `README.md`. Every UI task below tells the implementer to read the relevant README section before styling; consult the `.dc.html` file directly for anything the README doesn't spell out exactly (e.g. precise modal copy for the report paywall).

---

### Task 1: Database migration — cv_text column, report_unlocks, fitment_reports

**Files:**
- Create: `supabase/migrations/0003_dashboard_report_unlock.sql`

**Interfaces:**
- Produces: `fitment_leads.cv_text` (nullable `text` column), `report_unlocks` table (`user_id uuid`, `role_title text`, `unlocked_at timestamptz`, composite primary key `(user_id, role_title)`), `fitment_reports` table (`user_id uuid`, `role_title text`, `strengths text[]`, `gaps text[]`, `cv_fixes text[]`, `generated_at timestamptz`, composite primary key `(user_id, role_title)`). Later tasks upsert into both new tables using `onConflict: "user_id,role_title"`, which relies on this composite primary key.

- [ ] **Step 1: Write the migration**

```sql
alter table fitment_leads
  add column if not exists cv_text text;

create table if not exists report_unlocks (
  user_id uuid not null references auth.users(id),
  role_title text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, role_title)
);

alter table report_unlocks enable row level security;

drop policy if exists "Users can view their own report unlocks" on report_unlocks;

create policy "Users can view their own report unlocks"
  on report_unlocks
  for select
  using (auth.uid() = user_id);

create table if not exists fitment_reports (
  user_id uuid not null references auth.users(id),
  role_title text not null,
  strengths text[] not null,
  gaps text[] not null,
  cv_fixes text[] not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, role_title)
);

alter table fitment_reports enable row level security;

drop policy if exists "Users can view their own fitment reports" on fitment_reports;

create policy "Users can view their own fitment reports"
  on fitment_reports
  for select
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Verify the file is valid, idempotent SQL by reading it back**

There is no automated test for this file (no live Postgres in this environment — a human applies it later, same precedent as migrations `0001`/`0002`). Read the file back and confirm: every `create table`/`add column` uses `if not exists`, and the `create policy` statements are each preceded by a matching `drop policy if exists` with the exact same policy name — this is what makes the file safe to re-run without erroring, matching migration `0002`'s established pattern.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_dashboard_report_unlock.sql
git commit -m "feat(hub): add migration for cv_text, report_unlocks, fitment_reports"
```

---

### Task 2: lib/generateFitmentReport.ts — detailed breakdown generation

**Files:**
- Create: `lib/generateFitmentReport.ts`
- Test: `lib/__tests__/generateFitmentReport.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export type FitmentReportResult = { strengths: string[]; gaps: string[]; cvFixes: string[] }` and `export async function generateFitmentReport(jdText: string, cvText: string, score: number): Promise<FitmentReportResult>`. Task 4's Route Handler calls this directly.

This file mirrors `lib/scoreFitment.ts` exactly (read it at `lib/scoreFitment.ts` first) — same Claude client construction, same `claude-haiku-4-5` model, same `zodOutputFormat` structured-output pattern, same "throw if no parsed_output" guard.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const parseMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { parse: parseMock };
    },
  };
});

describe("generateFitmentReport", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("returns the parsed strengths, gaps, and CV fixes from Claude", async () => {
    parseMock.mockResolvedValue({
      parsed_output: {
        strengths: ["Strong product sense", "5+ years B2B SaaS experience"],
        gaps: ["No direct people-management experience"],
        cvFixes: ["Quantify the revenue impact of your last two launches"],
      },
    });
    const { generateFitmentReport } = await import("../generateFitmentReport");
    const result = await generateFitmentReport("Senior PM JD text", "CV text", 7.8);
    expect(result).toEqual({
      strengths: ["Strong product sense", "5+ years B2B SaaS experience"],
      gaps: ["No direct people-management experience"],
      cvFixes: ["Quantify the revenue impact of your last two launches"],
    });
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("throws if Claude returns no parsed output", async () => {
    parseMock.mockResolvedValue({ parsed_output: null });
    const { generateFitmentReport } = await import("../generateFitmentReport");
    await expect(generateFitmentReport("jd", "cv", 7.8)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/generateFitmentReport.test.ts`
Expected: FAIL with a module-not-found error for `../generateFitmentReport`.

- [ ] **Step 3: Write the implementation**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export type FitmentReportResult = {
  strengths: string[];
  gaps: string[];
  cvFixes: string[];
};

const FitmentReportSchema = z.object({
  strengths: z.array(z.string()).min(1),
  gaps: z.array(z.string()).min(1),
  cvFixes: z.array(z.string()).min(1),
});

export async function generateFitmentReport(
  jdText: string,
  cvText: string,
  score: number
): Promise<FitmentReportResult> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content:
          "You are writing a detailed fitment breakdown for a candidate who scored " +
          `${score}/10 against a job description.\n\n` +
          `Job description:\n${jdText}\n\n` +
          `Candidate CV:\n${cvText}\n\n` +
          "Return 2-4 concrete strengths (specific to this candidate and role, not generic), " +
          "2-4 concrete gaps costing them shortlists, and 2-4 specific, actionable suggestions " +
          "for how to improve their CV for this exact role.",
      },
    ],
    output_config: {
      format: zodOutputFormat(FitmentReportSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable fitment report.");
  }

  return response.parsed_output;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/generateFitmentReport.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add lib/generateFitmentReport.ts lib/__tests__/generateFitmentReport.test.ts
git commit -m "feat(hub): add generateFitmentReport for detailed report breakdown"
```

---

### Task 3: lib/reportUnlocks.ts — entitlement read/write

**Files:**
- Create: `lib/reportUnlocks.ts`
- Test: `lib/__tests__/reportUnlocks.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient` from `@/lib/supabase` (existing, admin client).
- Produces: `export async function unlockReport(userId: string, roleTitle: string): Promise<void>` and `export async function isReportUnlocked(userId: string, roleTitle: string): Promise<boolean>`. Task 4's Route Handler calls both.

This mirrors `lib/claimFitmentLeads.ts`'s mocking pattern (read `lib/__tests__/claimFitmentLeads.test.ts` first) but uses `upsert` with `onConflict` instead of `update`, since this writes new rows rather than updating existing ones — `upsert` is what makes `unlockReport` idempotent (calling it twice for the same user+role never errors or duplicates), matching Task 1's composite primary key.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn();
const eqMock1 = vi.fn();
const eqMock2 = vi.fn();
const maybeSingleMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: fromMock,
  }),
}));

describe("reportUnlocks", () => {
  beforeEach(() => {
    fromMock.mockReset();
    upsertMock.mockReset();
    selectMock.mockReset();
    eqMock1.mockReset();
    eqMock2.mockReset();
    maybeSingleMock.mockReset();
  });

  describe("unlockReport", () => {
    it("upserts a report_unlocks row keyed on user_id + role_title", async () => {
      fromMock.mockReturnValue({ upsert: upsertMock });
      upsertMock.mockResolvedValue({ error: null });
      const { unlockReport } = await import("../reportUnlocks");

      await unlockReport("user-123", "Senior Product Manager");

      expect(fromMock).toHaveBeenCalledWith("report_unlocks");
      expect(upsertMock).toHaveBeenCalledWith(
        { user_id: "user-123", role_title: "Senior Product Manager" },
        { onConflict: "user_id,role_title" }
      );
    });

    it("does not throw when called twice for the same user+role (idempotent)", async () => {
      fromMock.mockReturnValue({ upsert: upsertMock });
      upsertMock.mockResolvedValue({ error: null });
      const { unlockReport } = await import("../reportUnlocks");

      await unlockReport("user-123", "Senior Product Manager");
      await expect(unlockReport("user-123", "Senior Product Manager")).resolves.toBeUndefined();
    });

    it("throws if Supabase returns an error", async () => {
      fromMock.mockReturnValue({ upsert: upsertMock });
      upsertMock.mockResolvedValue({ error: { message: "db error" } });
      const { unlockReport } = await import("../reportUnlocks");

      await expect(unlockReport("user-123", "Senior Product Manager")).rejects.toThrow();
    });
  });

  describe("isReportUnlocked", () => {
    it("returns true when a matching row exists", async () => {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ eq: eqMock2 });
      eqMock2.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({ data: { user_id: "user-123" }, error: null });

      const { isReportUnlocked } = await import("../reportUnlocks");
      const result = await isReportUnlocked("user-123", "Senior Product Manager");

      expect(fromMock).toHaveBeenCalledWith("report_unlocks");
      expect(eqMock1).toHaveBeenCalledWith("user_id", "user-123");
      expect(eqMock2).toHaveBeenCalledWith("role_title", "Senior Product Manager");
      expect(result).toBe(true);
    });

    it("returns false when no matching row exists", async () => {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ eq: eqMock2 });
      eqMock2.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const { isReportUnlocked } = await import("../reportUnlocks");
      const result = await isReportUnlocked("user-123", "Senior Product Manager");

      expect(result).toBe(false);
    });

    it("throws if Supabase returns an error", async () => {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock1 });
      eqMock1.mockReturnValue({ eq: eqMock2 });
      eqMock2.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue({ data: null, error: { message: "db error" } });

      const { isReportUnlocked } = await import("../reportUnlocks");
      await expect(isReportUnlocked("user-123", "Senior Product Manager")).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/reportUnlocks.test.ts`
Expected: FAIL with a module-not-found error for `../reportUnlocks`.

- [ ] **Step 3: Write the implementation**

```typescript
import { getSupabaseServerClient } from "@/lib/supabase";

export async function unlockReport(userId: string, roleTitle: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("report_unlocks")
    .upsert({ user_id: userId, role_title: roleTitle }, { onConflict: "user_id,role_title" });

  if (error) {
    throw new Error(`Failed to unlock report: ${error.message}`);
  }
}

export async function isReportUnlocked(userId: string, roleTitle: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_unlocks")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role_title", roleTitle)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check report unlock status: ${error.message}`);
  }

  return Boolean(data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/reportUnlocks.test.ts`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add lib/reportUnlocks.ts lib/__tests__/reportUnlocks.test.ts
git commit -m "feat(hub): add reportUnlocks entitlement read/write helpers"
```

---

### Task 4: app/api/hub/unlock-report/route.ts — unlock endpoint

**Files:**
- Create: `app/api/hub/unlock-report/route.ts`
- Test: `app/api/hub/unlock-report/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` from `@/lib/supabaseAuthServer` (Task from Phase 1, already exists), `unlockReport`/`isReportUnlocked` from `@/lib/reportUnlocks` (Task 3), `generateFitmentReport` from `@/lib/generateFitmentReport` (Task 2), `getSupabaseServerClient` from `@/lib/supabase` (existing admin client).
- Produces: `POST` handler at `/api/hub/unlock-report`. Request body: `{ roleTitle: string }` (JSON). Response shapes: `{ status: "unlocked", report: { strengths, gaps, cvFixes } }` on success with CV text available, `{ status: "needs_cv" }` on success but no CV text on file for that role, `{ error: string }` with 401/400/500 on failure. Task 10 (`ReportPaywallModal.tsx`) calls this endpoint and branches on `status`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const leadSelectMock = vi.fn();
const leadEq1Mock = vi.fn();
const leadEq2Mock = vi.fn();
const leadOrderMock = vi.fn();
const leadLimitMock = vi.fn();
const leadMaybeSingleMock = vi.fn();
const sessionFromMock = vi.fn();

const unlockReportMock = vi.fn();
const generateFitmentReportMock = vi.fn();

const reportUpsertMock = vi.fn();
const adminFromMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: sessionFromMock,
  }),
}));
vi.mock("@/lib/reportUnlocks", () => ({
  unlockReport: unlockReportMock,
  isReportUnlocked: vi.fn(),
}));
vi.mock("@/lib/generateFitmentReport", () => ({
  generateFitmentReport: generateFitmentReportMock,
}));
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: adminFromMock }),
}));

function buildLeadChain(result: { data: unknown; error: unknown }) {
  sessionFromMock.mockReturnValue({ select: leadSelectMock });
  leadSelectMock.mockReturnValue({ eq: leadEq1Mock });
  leadEq1Mock.mockReturnValue({ eq: leadEq2Mock });
  leadEq2Mock.mockReturnValue({ order: leadOrderMock });
  leadOrderMock.mockReturnValue({ limit: leadLimitMock });
  leadLimitMock.mockReturnValue({ maybeSingle: leadMaybeSingleMock });
  leadMaybeSingleMock.mockResolvedValue(result);
}

async function importRoute() {
  return await import("../route");
}

describe("POST /api/hub/unlock-report", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    sessionFromMock.mockReset();
    leadSelectMock.mockReset();
    leadEq1Mock.mockReset();
    leadEq2Mock.mockReset();
    leadOrderMock.mockReset();
    leadLimitMock.mockReset();
    leadMaybeSingleMock.mockReset();
    unlockReportMock.mockReset();
    generateFitmentReportMock.mockReset();
    reportUpsertMock.mockReset();
    adminFromMock.mockReset();
    adminFromMock.mockReturnValue({ upsert: reportUpsertMock });
    reportUpsertMock.mockResolvedValue({ error: null });
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when roleTitle is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when no fitment_leads row matches the role for this user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({ data: null, error: null });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(unlockReportMock).not.toHaveBeenCalled();
  });

  it("unlocks and generates the report when CV text is on file", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({
      data: { jd_text: "JD text", cv_text: "CV text", score: 7.8 },
      error: null,
    });
    unlockReportMock.mockResolvedValue(undefined);
    generateFitmentReportMock.mockResolvedValue({
      strengths: ["a"],
      gaps: ["b"],
      cvFixes: ["c"],
    });

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(unlockReportMock).toHaveBeenCalledWith("user-123", "Senior Product Manager");
    expect(generateFitmentReportMock).toHaveBeenCalledWith("JD text", "CV text", 7.8);
    expect(adminFromMock).toHaveBeenCalledWith("fitment_reports");
    expect(reportUpsertMock).toHaveBeenCalledWith(
      {
        user_id: "user-123",
        role_title: "Senior Product Manager",
        strengths: ["a"],
        gaps: ["b"],
        cv_fixes: ["c"],
      },
      { onConflict: "user_id,role_title" }
    );
    expect(body).toEqual({ status: "unlocked", report: { strengths: ["a"], gaps: ["b"], cvFixes: ["c"] } });
  });

  it("unlocks but returns needs_cv when there is no CV text on file", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({
      data: { jd_text: "JD text", cv_text: null, score: 7.8 },
      error: null,
    });
    unlockReportMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(unlockReportMock).toHaveBeenCalledWith("user-123", "Senior Product Manager");
    expect(generateFitmentReportMock).not.toHaveBeenCalled();
    expect(body).toEqual({ status: "needs_cv" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/hub/unlock-report/__tests__/route.test.ts`
Expected: FAIL with a module-not-found error for `../route`.

- [ ] **Step 3: Write the implementation**

```typescript
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { unlockReport } from "@/lib/reportUnlocks";
import { generateFitmentReport } from "@/lib/generateFitmentReport";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { roleTitle?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const roleTitle = typeof body.roleTitle === "string" ? body.roleTitle.trim() : "";
  if (!roleTitle) {
    return Response.json({ error: "roleTitle is required." }, { status: 400 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("jd_text, cv_text, score")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ error: "No fitment check found for this role." }, { status: 400 });
  }

  try {
    await unlockReport(user.id, roleTitle);
  } catch {
    return Response.json({ error: "Something went wrong unlocking the report." }, { status: 500 });
  }

  if (!lead.cv_text) {
    return Response.json({ status: "needs_cv" });
  }

  let report;
  try {
    report = await generateFitmentReport(lead.jd_text, lead.cv_text, lead.score);
  } catch {
    return Response.json({ error: "Unlocked, but the report failed to generate — please refresh." }, { status: 500 });
  }

  const admin = getSupabaseServerClient();
  const { error: reportError } = await admin.from("fitment_reports").upsert(
    {
      user_id: user.id,
      role_title: roleTitle,
      strengths: report.strengths,
      gaps: report.gaps,
      cv_fixes: report.cvFixes,
    },
    { onConflict: "user_id,role_title" }
  );

  if (reportError) {
    return Response.json({ error: "Unlocked, but the report failed to save — please refresh." }, { status: 500 });
  }

  return Response.json({ status: "unlocked", report });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/hub/unlock-report/__tests__/route.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/unlock-report/route.ts app/api/hub/unlock-report/__tests__/route.test.ts
git commit -m "feat(hub): add unlock-report endpoint (fake-pay, real entitlement + report)"
```

---

### Task 5: Persist CV text from the anonymous check + consent copy

**Files:**
- Modify: `app/api/hub/fitment-check/route.ts`
- Modify: `app/hub/FitmentChecker.tsx`
- Modify: `app/api/hub/fitment-check/__tests__/route.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `fitment_leads` rows now include `cv_text` on insert (previously discarded after scoring). No new exported functions.

- [ ] **Step 1: Update the existing route test to assert cv_text is inserted**

In `app/api/hub/fitment-check/__tests__/route.test.ts`, update the first test (`"returns 200 with the score for a valid submission"`) to also assert the insert payload includes the extracted CV text:

```typescript
  it("returns 200 with the score for a valid submission", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ score: 7.8, verdict: "Good fit." });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ cv_text: "Extracted CV text" })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/hub/fitment-check/__tests__/route.test.ts`
Expected: FAIL on the new assertion — the insert call doesn't include `cv_text` yet.

- [ ] **Step 3: Update the route to persist cv_text**

In `app/api/hub/fitment-check/route.ts`, the insert call currently reads:

```typescript
  const supabase = getSupabaseServerClient();
  const { error: insertError } = await supabase.from("fitment_leads").insert({
    email,
    role_title: role,
    jd_text: jdForScoring,
    jd_source: jdSource,
    score: result.score,
    verdict: result.verdict,
  });
```

Change it to include `cv_text` (the already-parsed, already-truncated `cvText` variable defined earlier in the same function):

```typescript
  const supabase = getSupabaseServerClient();
  const { error: insertError } = await supabase.from("fitment_leads").insert({
    email,
    role_title: role,
    jd_text: jdForScoring,
    jd_source: jdSource,
    score: result.score,
    verdict: result.verdict,
    cv_text: cvText,
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/hub/fitment-check/__tests__/route.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Add consent copy to the CV upload step**

In `app/hub/FitmentChecker.tsx`, the CV upload dropzone is followed immediately by the reCAPTCHA block and then the submit button (around line 261-270). Add a short consent line directly below the upload dropzone `<div>` (the one with the file-icon SVG and "Upload your CV" text), before the reCAPTCHA block:

```tsx
      <p className="text-[#9c9c9c]" style={{ fontSize: 11, lineHeight: 1.5, margin: "8px 0 0" }}>
        By uploading, you agree to Merito storing your CV to build your profile — see our{" "}
        <Link href="/privacy" className="text-[#9c9c9c] underline">
          Privacy Policy
        </Link>
        .
      </p>
```

This goes immediately after the closing `</div>` of the upload dropzone block (the one containing the SVG icon and `{cvFile ? ... : "Upload your CV..."}` text), and before the `{recaptchaEnabled ? (...)` block. `Link` is already imported in this file (used elsewhere for the "Create your free account" link), no new import needed.

- [ ] **Step 6: Run the full test suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 7: Commit**

```bash
git add app/api/hub/fitment-check/route.ts app/hub/FitmentChecker.tsx app/api/hub/fitment-check/__tests__/route.test.ts
git commit -m "feat(hub): persist parsed CV text going forward, add storage consent copy"
```

---

### Task 6: app/privacy/page.tsx — privacy policy page

**Files:**
- Create: `app/privacy/page.tsx`

**Interfaces:**
- Consumes: nothing (static page, uses the global `app/layout.tsx` nav/footer already).
- Produces: a route at `/privacy`, linked from Task 5's consent copy.

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Merito collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "64px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "2rem", margin: "0 0 8px" }}>
          Privacy Policy
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 32px" }}>
          Last updated: July 2026
        </p>

        <div className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.8 }}>
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            What we collect
          </h2>
          <p>
            When you use Merito HUB to check your fitment for a role, we collect the email
            address, target role, job description, and CV you provide. Your CV is parsed to
            extract its text content, which we store to generate your fitment score and, if
            you unlock it, your detailed fitment report — so you don&apos;t need to re-upload
            your CV every time you return.
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            How we use it
          </h2>
          <p>
            Your CV and job description text are used to generate your fitment score and
            report via an AI model, and to build your Merito HUB profile. If you&apos;re
            looking for a new role, we may also use this information to match you with
            relevant opportunities through Merito&apos;s recruitment services.
          </p>

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

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            Contact
          </h2>
          <p>
            Questions about this policy or your data can be sent to{" "}
            <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">
              admin@merito.ai
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `npm run dev` (or use an already-running dev server), visit `http://localhost:3000/privacy`.
Expected: page renders with the site's global nav/footer, no console errors.

This is a static page with no automated test, matching this plan's Global Constraints on UI-only pieces.

- [ ] **Step 3: Commit**

```bash
git add app/privacy/page.tsx
git commit -m "feat(hub): add privacy policy page"
```

---

### Task 7: app/hub/account/TopBar.tsx — dashboard top bar

**Files:**
- Create: `app/hub/account/TopBar.tsx`

**Interfaces:**
- Consumes: existing `app/hub/account/SignOutButton.tsx` (unchanged, reused as-is).
- Produces: `export default function TopBar({ roleTitle, onChangeRole }: { roleTitle: string; onChangeRole: () => void })`. Task 12 (`page.tsx`) renders this and passes a handler that opens `ChangeRoleModal` (Task 11).

Read the design's README `## Layout (desktop ≥1200px)` section (top-bar bullet) and the `.dc.html` file's top-bar markup for exact spacing/copy before styling — this task reproduces the described structure (logo + red HUB badge + "Dashboard" label on the left; target-role pill with "Change" + avatar on the right) using this repo's existing design tokens.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import Image from "next/image";
import SignOutButton from "./SignOutButton";

export default function TopBar({ roleTitle, onChangeRole }: { roleTitle: string; onChangeRole: () => void }) {
  return (
    <header
      className="sticky top-0 bg-white border-b border-black/[0.08] flex items-center justify-between"
      style={{ height: 66, padding: "0 24px", zIndex: 20, boxShadow: "0 8px 22px rgba(17,35,89,0.06)" }}
    >
      <div className="flex items-center" style={{ gap: 10 }}>
        <Image src="/logo.png" alt="Merito" width={100} height={28} style={{ height: 24, width: "auto" }} />
        <span
          className="bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold"
          style={{ fontSize: 10, letterSpacing: "0.06em", borderRadius: 50, padding: "3px 9px" }}
        >
          HUB
        </span>
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d] hidden sm:inline" style={{ fontSize: 13 }}>
          Dashboard
        </span>
      </div>

      <div className="flex items-center" style={{ gap: 12 }}>
        <button
          onClick={onChangeRole}
          className="flex items-center bg-[#fdeced] font-[family-name:var(--font-poppins)] font-semibold text-black"
          style={{ borderRadius: 50, padding: "6px 6px 6px 14px", fontSize: 12, border: "none", cursor: "pointer", gap: 8 }}
        >
          <span className="hidden sm:inline">{roleTitle}</span>
          <span
            className="bg-[#ed1a24] text-white"
            style={{ borderRadius: 50, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}
          >
            Change
          </span>
        </button>
        <div
          className="bg-[#fdeced] flex items-center justify-center font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24]"
          style={{ width: 36, height: 36, borderRadius: "50%", fontSize: 13 }}
        >
          {roleTitle ? roleTitle.charAt(0).toUpperCase() : "M"}
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors referencing `TopBar.tsx` (it isn't imported anywhere yet — this just confirms the file itself is syntactically/typewise valid in isolation; full integration is verified in Task 12).

- [ ] **Step 3: Commit**

```bash
git add app/hub/account/TopBar.tsx
git commit -m "feat(hub): add dashboard TopBar component"
```

---

### Task 8: app/hub/account/ProgressRail.tsx — left rail progress card

**Files:**
- Create: `app/hub/account/ProgressRail.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export default function ProgressRail({ reportUnlocked, onOpenReportPaywall }: { reportUnlocked: boolean; onOpenReportPaywall: () => void })`. Task 12 renders this, passing a handler that opens `ReportPaywallModal` (Task 10).

Read the design README's `### Left rail — progress` section for the exact ring/row visual spec before styling. This task implements only the progress card and its 5 step rows — the bundle card and expert card described in that same README section are explicitly out of scope this phase (Global Constraints).

- [ ] **Step 1: Write the component**

```tsx
"use client";

const STEPS = [
  { key: "score", label: "Job fitment score" },
  { key: "report", label: "Detailed report" },
  { key: "personality", label: "Personality test" },
  { key: "references", label: "Reference checks" },
  { key: "interview", label: "Mock AI interview" },
] as const;

export default function ProgressRail({
  reportUnlocked,
  onOpenReportPaywall,
}: {
  reportUnlocked: boolean;
  onOpenReportPaywall: () => void;
}) {
  const doneCount = 1 + (reportUnlocked ? 1 : 0); // score is always done; report counts once unlocked
  const percent = Math.round((doneCount / STEPS.length) * 100);
  const circumference = 2 * Math.PI * 31;
  const dashoffset = circumference - (percent / 100) * circumference;

  return (
    <div
      className="bg-white border border-black/[0.08]"
      style={{ borderRadius: 20, padding: 20, boxShadow: "0 18px 50px rgba(17,35,89,0.05)" }}
    >
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 14px" }}>
        Profile Progress
      </p>

      <div className="flex items-center" style={{ gap: 14, marginBottom: 16 }}>
        <svg width="74" height="74" viewBox="0 0 74 74">
          <circle cx="37" cy="37" r="31" fill="none" stroke="#f0e6ea" strokeWidth="8" />
          <circle
            cx="37"
            cy="37"
            r="31"
            fill="none"
            stroke="#ed1a24"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            transform="rotate(-90 37 37)"
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.23,1,0.32,1)" }}
          />
          <text x="37" y="42" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0a0a0a">
            {percent}%
          </text>
        </svg>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13 }}>
          {doneCount} of {STEPS.length} steps complete
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {STEPS.map((step, i) => {
          const isDone = step.key === "score" || (step.key === "report" && reportUnlocked);
          const isReportLocked = step.key === "report" && !reportUnlocked;
          const isComingSoon = step.key === "personality" || step.key === "references" || step.key === "interview";

          return (
            <div
              key={step.key}
              onClick={isReportLocked ? onOpenReportPaywall : undefined}
              className={isDone ? "bg-[#eefdf1]" : isReportLocked ? "bg-[#fdf8fb]" : "bg-white"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 12,
                minHeight: 44,
                cursor: isReportLocked ? "pointer" : "default",
                borderLeft: isReportLocked ? "5px solid #ed1a24" : "5px solid transparent",
              }}
            >
              <div
                className={isDone ? "bg-[#eefdf1] text-[#16803c]" : isComingSoon ? "bg-[#f0e6ea] text-[#9c9c9c]" : "bg-[#fdeced] text-[#ed1a24]"}
                style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, flex: 1 }}>
                {step.label}
              </span>
              {isComingSoon && (
                <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11 }}>
                  Coming soon
                </span>
              )}
              {isReportLocked && (
                <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 11 }}>
                  ₹299
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors referencing `ProgressRail.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/hub/account/ProgressRail.tsx
git commit -m "feat(hub): add dashboard ProgressRail component"
```

---

### Task 9: app/hub/account/ScoreCard.tsx — center fitment score card

**Files:**
- Create: `app/hub/account/ScoreCard.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (receives all data as props).
- Produces: `export default function ScoreCard(props: { roleTitle: string; score: number; prevScore: number | null; verdict: string; reportUnlocked: boolean; report: { strengths: string[]; gaps: string[]; cvFixes: string[] } | null; onOpenReportPaywall: () => void })`. Task 12 renders this with data read from `fitment_leads`/`fitment_reports`.

Read the design README's `### Center — current step` section (fitment score card sub-bullet) for exact copy/spacing before styling.

- [ ] **Step 1: Write the component**

```tsx
"use client";

export default function ScoreCard({
  roleTitle,
  score,
  prevScore,
  verdict,
  reportUnlocked,
  report,
  onOpenReportPaywall,
}: {
  roleTitle: string;
  score: number;
  prevScore: number | null;
  verdict: string;
  reportUnlocked: boolean;
  report: { strengths: string[]; gaps: string[]; cvFixes: string[] } | null;
  onOpenReportPaywall: () => void;
}) {
  const delta = prevScore !== null ? Math.round((score - prevScore) * 10) / 10 : null;

  return (
    <div
      className="bg-white border border-black/[0.08]"
      style={{ borderRadius: 20, padding: 24, boxShadow: "0 18px 50px rgba(17,35,89,0.05)" }}
    >
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <span
          className="rounded-full bg-[#ed1a24] inline-block"
          style={{ width: 8, height: 8 }}
        />
        <span className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#4b4b4d]" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
          Your Job Fitment Score
        </span>
        <span
          className="bg-[#eefdf1] text-[#16803c] font-[family-name:var(--font-poppins)] font-bold"
          style={{ fontSize: 10, borderRadius: 50, padding: "3px 9px", marginLeft: "auto" }}
        >
          ✓ Step 1 complete
        </span>
      </div>

      <div className="flex items-baseline flex-wrap" style={{ gap: 10 }}>
        <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "3.2rem", lineHeight: 1, whiteSpace: "nowrap" }}>
          {score.toFixed(1)}<span className="font-semibold text-[#9c9c9c]" style={{ fontSize: "1.2rem" }}> / 10</span>
        </span>
        {delta !== null && delta !== 0 && (
          <span
            className={delta > 0 ? "bg-[#eefdf1] text-[#16803c]" : "bg-[#fdeced] text-[#ed1a24]"}
            style={{ fontSize: 12, fontWeight: 700, borderRadius: 50, padding: "4px 10px" }}
          >
            {delta > 0 ? "↑" : "↓"} was {prevScore?.toFixed(1)}
          </span>
        )}
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13, marginLeft: "auto" }}>
          fit for {roleTitle}
        </span>
      </div>

      <div className="bg-[#f0e6ea] overflow-hidden" style={{ marginTop: 12, height: 12, borderRadius: 6 }}>
        <div className="bg-[#ed1a24] h-full" style={{ borderRadius: 6, width: `${score * 10}%` }} />
      </div>

      <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: "12px 0 0" }}>
        {verdict}
      </p>

      {!reportUnlocked ? (
        <>
          <button
            onClick={onOpenReportPaywall}
            className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ marginTop: 18, height: 48, borderRadius: 8, fontSize: 14, background: "#ed1a24", border: "none", cursor: "pointer", boxShadow: "0 4px 6px rgba(236,34,40,0.3)" }}
          >
            🔒 See my detailed report
          </button>
          <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "10px 0 0", lineHeight: 1.6 }}>
            Why {score.toFixed(1)}? Your strengths, your gaps, and how to fix your CV — ₹299
          </p>
        </>
      ) : report ? (
        <div className="flex flex-col sm:flex-row" style={{ gap: 12, marginTop: 18 }}>
          <div className="bg-[#eefdf1]" style={{ borderRadius: 12, padding: 14, flex: 1 }}>
            <p className="font-[family-name:var(--font-poppins)] font-bold text-[#16803c]" style={{ fontSize: 11, margin: "0 0 6px" }}>
              Top strengths
            </p>
            {report.strengths.slice(0, 2).map((s, i) => (
              <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, margin: "4px 0" }}>
                {s}
              </p>
            ))}
          </div>
          <div className="bg-[#fdeced]" style={{ borderRadius: 12, padding: 14, flex: 1 }}>
            <p className="font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24]" style={{ fontSize: 11, margin: "0 0 6px" }}>
              Gaps costing you shortlists
            </p>
            {report.gaps.slice(0, 2).map((g, i) => (
              <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, margin: "4px 0" }}>
                {g}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "18px 0 0" }}>
          Unlocked — your report is generating. Refresh in a moment.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors referencing `ScoreCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/hub/account/ScoreCard.tsx
git commit -m "feat(hub): add dashboard ScoreCard component"
```

---

### Task 10: app/hub/account/ReportPaywallModal.tsx — report unlock modal

**Files:**
- Create: `app/hub/account/ReportPaywallModal.tsx`

**Interfaces:**
- Consumes: `POST /api/hub/unlock-report` (Task 4).
- Produces: `export default function ReportPaywallModal({ roleTitle, onClose, onUnlocked }: { roleTitle: string; onClose: () => void; onUnlocked: (report: { strengths: string[]; gaps: string[]; cvFixes: string[] }) => void })`. Task 12 renders this conditionally and passes a handler that updates local state so `ScoreCard`/`ProgressRail` reflect the unlock without a full page reload.

Read the design README's `## Paywall / offering modals (shared component)` section for exact modal structure/copy (sample panel, includes list, microcopy) before styling — this task implements the report's specific ₹299 configuration only.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";

export default function ReportPaywallModal({
  roleTitle,
  onClose,
  onUnlocked,
}: {
  roleTitle: string;
  onClose: () => void;
  onUnlocked: (report: { strengths: string[]; gaps: string[]; cvFixes: string[] }) => void;
}) {
  const [paying, setPaying] = useState(false);
  const [needsCv, setNeedsCv] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/unlock-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaying(false);
        setError(data.error || "Something went wrong — please try again.");
        return;
      }
      if (data.status === "needs_cv") {
        setPaying(false);
        setNeedsCv(true);
        return;
      }
      setPaying(false);
      onUnlocked(data.report);
    } catch {
      setPaying(false);
      setError("Something went wrong — please try again.");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white"
        style={{ maxWidth: 520, width: "100%", borderRadius: 24, padding: 28, position: "relative", maxHeight: "92vh", overflowY: "auto" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9c9c9c" }}
        >
          ✕
        </button>

        <span
          className="bg-[#fdeced] text-[#ed1a24] font-[family-name:var(--font-poppins)] font-bold"
          style={{ fontSize: 11, borderRadius: 50, padding: "4px 12px", display: "inline-block", marginBottom: 12 }}
        >
          Detailed Report
        </span>
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
          See exactly why you scored what you scored
        </h2>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>
          Your strengths, your gaps, and exactly how to fix your CV for {roleTitle}.
        </p>

        {needsCv ? (
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            Report unlocked — but we need your CV to generate it. Head back to the HUB and re-run a fitment check for this role, then return here.
          </p>
        ) : (
          <>
            <div className="bg-[#fdf8fb]" style={{ borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <span
                className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c] bg-white border border-[#dcdcdc]"
                style={{ fontSize: 9, letterSpacing: "0.06em", borderRadius: 50, padding: "3px 9px" }}
              >
                Sample
              </span>
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
                ✓ Strong product sense across 3 launches
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                ✓ 5+ years B2B SaaS experience
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
                ░░░░░░░░░░░░░░░░░░░░ (unlock for full breakdown)
              </p>
            </div>

            <button
              onClick={handlePay}
              disabled={paying}
              className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
              style={{ height: 50, borderRadius: 8, fontSize: 15, background: paying ? "#dcdcdc" : "#ed1a24", border: "none", cursor: paying ? "default" : "pointer", boxShadow: paying ? "none" : "0 4px 6px rgba(236,34,40,0.3)" }}
            >
              {paying ? "Unlocking…" : "Unlock full report — ₹299"}
            </button>
            <p className="text-[#9c9c9c]" style={{ fontSize: 11.5, textAlign: "center", margin: "10px 0 0" }}>
              One-time payment · No subscription · UPI, card & netbanking
            </p>
          </>
        )}

        {error && (
          <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>{error}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors referencing `ReportPaywallModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/hub/account/ReportPaywallModal.tsx
git commit -m "feat(hub): add ReportPaywallModal (fake-unlock report paywall)"
```

---

### Task 11: app/hub/account/ChangeRoleModal.tsx — change target role

**Files:**
- Create: `app/hub/account/ChangeRoleModal.tsx`
- Create: `app/api/hub/rescore-role/route.ts`

**Interfaces:**
- Consumes: `POST /api/hub/fitment-check` (existing Phase 0 endpoint — reused as-is for re-scoring; read `app/api/hub/fitment-check/route.ts` to confirm the exact `FormData` field names it expects: `role`, `jdText` or `jdUrl`, `cv`, `recaptchaToken`), `createSupabaseServerClient` from `@/lib/supabaseAuthServer`, `claimFitmentLeads` from `@/lib/claimFitmentLeads`.
- Produces: `export default function ChangeRoleModal({ onClose, onRoleChanged }: { onClose: () => void; onRoleChanged: (roleTitle: string) => void })` — no `email` prop; the new role's email comes from the authenticated session server-side, not the client. Task 12 renders this conditionally; `onRoleChanged` triggers a full data refetch (simplest correct approach — a `router.refresh()` call, since the new role's score/report-lock state all come from the Server Component). Also produces `POST /api/hub/rescore-role`, a thin wrapper this modal calls instead of `/api/hub/fitment-check` directly.

This reuses the existing anonymous fitment-check endpoint rather than a new one — a signed-in candidate submitting a new role/JD/CV is functionally the same "score this CV against this JD" operation Phase 0 already built, and the resulting `fitment_leads` row gets auto-claimed on the next login... but since this candidate is already logged in, the row needs `user_id` set at insert time directly, which the existing endpoint does NOT do (it only ever inserts anonymous rows with `user_id: null`). Read `app/api/hub/fitment-check/route.ts` Step 3 note below before assuming this reuse is complete.

- [ ] **Step 1: Confirm the gap and the fix approach**

The existing `/api/hub/fitment-check` endpoint always inserts with no `user_id` (it's the anonymous-check path). A change-role submission from a signed-in user would create an unclaimed row, which is wrong — it would never show up as "claimed" without another login-claim cycle. Rather than modify the anonymous endpoint's behavior (used by anonymous visitors too), this modal calls the same endpoint, then calls `claimFitmentLeads` implicitly by having the server associate it — the simplest correct fix is: after a successful anonymous-style submission, call the existing `claimFitmentLeads(userId, email)` function server-side. Since this needs a signed-in user's ID, this task adds one small new Route Handler rather than reusing the raw anonymous endpoint from the client.

- [ ] **Step 2: Add the thin wrapper endpoint (`app/api/hub/rescore-role/route.ts`)**

```typescript
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { claimFitmentLeads } from "@/lib/claimFitmentLeads";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await request.formData();
  form.set("email", user.email);

  const checkResponse = await fetch(new URL("/api/hub/fitment-check", request.url), {
    method: "POST",
    body: form,
  });
  const checkData = await checkResponse.json();

  if (!checkResponse.ok) {
    return Response.json(checkData, { status: checkResponse.status });
  }

  try {
    await claimFitmentLeads(user.id, user.email);
  } catch {
    // Non-fatal — the score was computed and stored; claiming can be
    // retried on next login if this fails, same tolerance Phase 1's
    // auth callback already applies to claiming.
  }

  return Response.json(checkData);
}
```

- [ ] **Step 3: Write the modal component**

```tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type JdMode = "paste" | "link";

export default function ChangeRoleModal({
  onClose,
  onRoleChanged,
}: {
  onClose: () => void;
  onRoleChanged: (roleTitle: string) => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [jdMode, setJdMode] = useState<JdMode>("paste");
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = role.trim() && (jdMode === "paste" ? jdText.trim() : jdUrl.trim()) && cvFile && !busy;

  const handleSubmit = async () => {
    if (!canSubmit || !cvFile) return;
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.set("role", role.trim());
    if (jdMode === "paste") form.set("jdText", jdText.trim());
    else form.set("jdUrl", jdUrl.trim());
    form.set("cv", cvFile);
    form.set("recaptchaToken", ""); // rescore-role runs server-side for an already-authenticated user; recaptcha applies to the anonymous path it delegates to, which is conditional and skips cleanly when unconfigured

    try {
      const res = await fetch("/api/hub/rescore-role", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setBusy(false);
        setError(data.error || "Something went wrong — please try again.");
        return;
      }
      setBusy(false);
      onRoleChanged(role.trim());
      router.refresh();
    } catch {
      setBusy(false);
      setError("Something went wrong — please try again.");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white"
        style={{ maxWidth: 480, width: "100%", borderRadius: 24, padding: 28, maxHeight: "92vh", overflowY: "auto" }}
      >
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 6px" }}>
          Change target role
        </h2>
        <p className="text-[#9c9c9c]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 18px" }}>
          Your completed steps carry over. The detailed report re-locks for the new role (₹299).
        </p>

        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Senior Product Manager"
          className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24]"
          style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
        />

        <div className="flex" style={{ gap: 8, marginBottom: 6 }}>
          <button type="button" onClick={() => setJdMode("paste")} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 50, border: "1px solid #dcdcdc", background: jdMode === "paste" ? "#ed1a24" : "#fff", color: jdMode === "paste" ? "#fff" : "#4b4b4d", cursor: "pointer" }}>
            Paste JD
          </button>
          <button type="button" onClick={() => setJdMode("link")} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 50, border: "1px solid #dcdcdc", background: jdMode === "link" ? "#ed1a24" : "#fff", color: jdMode === "link" ? "#fff" : "#4b4b4d", cursor: "pointer" }}>
            JD link
          </button>
        </div>
        {jdMode === "paste" ? (
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job description here..."
            className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] resize-none"
            style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, height: 120, marginBottom: 12 }}
          />
        ) : (
          <input
            value={jdUrl}
            onChange={(e) => setJdUrl(e.target.value)}
            placeholder="https://company.com/careers/role"
            className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24]"
            style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => setCvFile(e.target.files?.[0] || null)}
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          className="bg-white cursor-pointer flex items-center"
          style={{ border: `1.5px dashed ${cvFile ? "#22c55e" : "#dcdcdc"}`, borderRadius: 10, padding: "14px 16px", gap: 12, marginBottom: 16 }}
        >
          <span className="font-[family-name:var(--font-poppins)] font-semibold" style={{ fontSize: 13, color: cvFile ? "#16803c" : "#4b4b4d" }}>
            {cvFile ? `${cvFile.name} - ready ✓` : "Upload your CV (PDF or DOCX)"}
          </span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ height: 48, borderRadius: 8, fontSize: 14, background: canSubmit ? "#ed1a24" : "#dcdcdc", border: "none", cursor: canSubmit ? "pointer" : "default" }}
        >
          {busy ? "Re-evaluating your fitment…" : "Re-evaluate my fitment"}
        </button>

        {error && <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify it type-checks**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors referencing `ChangeRoleModal.tsx` or `app/api/hub/rescore-role/route.ts`.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all files (no test file exists for `rescore-role` — it's a thin wrapper over the already-tested `fitment-check` route and already-tested `claimFitmentLeads`, matching this plan's "fold trivial wrapper glue into the task it serves" scoping; manual verification happens in Task 13's full E2E pass).

- [ ] **Step 6: Commit**

```bash
git add app/hub/account/ChangeRoleModal.tsx app/api/hub/rescore-role/route.ts
git commit -m "feat(hub): add ChangeRoleModal and rescore-role endpoint"
```

---

### Task 12: app/hub/account/page.tsx — assemble the dashboard shell

**Files:**
- Modify (full rewrite): `app/hub/account/page.tsx`
- Delete: none (the file is rewritten, not removed)

**Interfaces:**
- Consumes: `createSupabaseServerClient` from `@/lib/supabaseAuthServer`, `isReportUnlocked` from `@/lib/reportUnlocks`, `TopBar` (Task 7), `ProgressRail` (Task 8), `ScoreCard` (Task 9), and a new small Client Component `DashboardClient` (this task) that owns which modal, if any, is open and the locally-updated unlock/report state so the UI reflects an unlock instantly without a full navigation.
- Produces: the `/hub/account` route.

- [ ] **Step 1: Write a small client wrapper that owns modal + optimistic unlock state**

```tsx
// app/hub/account/DashboardClient.tsx
"use client";

import { useState } from "react";
import TopBar from "./TopBar";
import ProgressRail from "./ProgressRail";
import ScoreCard from "./ScoreCard";
import ReportPaywallModal from "./ReportPaywallModal";
import ChangeRoleModal from "./ChangeRoleModal";

type ReportData = { strengths: string[]; gaps: string[]; cvFixes: string[] };

export default function DashboardClient({
  roleTitle,
  score,
  prevScore,
  verdict,
  initialReportUnlocked,
  initialReport,
}: {
  roleTitle: string;
  score: number;
  prevScore: number | null;
  verdict: string;
  initialReportUnlocked: boolean;
  initialReport: ReportData | null;
}) {
  const [modal, setModal] = useState<"none" | "report" | "changeRole">("none");
  const [reportUnlocked, setReportUnlocked] = useState(initialReportUnlocked);
  const [report, setReport] = useState<ReportData | null>(initialReport);

  return (
    <>
      <TopBar roleTitle={roleTitle} onChangeRole={() => setModal("changeRole")} />

      <div
        className="mx-auto"
        style={{ maxWidth: 1440, padding: 24, display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 22 }}
      >
        <ProgressRail reportUnlocked={reportUnlocked} onOpenReportPaywall={() => setModal("report")} />

        <div>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.9rem", letterSpacing: "-0.03em", margin: "0 0 6px" }}>
            Hi — here&apos;s where you stand.
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, margin: "0 0 20px" }}>
            {reportUnlocked ? "Your detailed report is unlocked." : "1 step left to a profile recruiters can't ignore."}
          </p>

          <ScoreCard
            roleTitle={roleTitle}
            score={score}
            prevScore={prevScore}
            verdict={verdict}
            reportUnlocked={reportUnlocked}
            report={report}
            onOpenReportPaywall={() => setModal("report")}
          />
        </div>
      </div>

      {modal === "report" && (
        <ReportPaywallModal
          roleTitle={roleTitle}
          onClose={() => setModal("none")}
          onUnlocked={(unlockedReport) => {
            setReportUnlocked(true);
            setReport(unlockedReport);
            setModal("none");
          }}
        />
      )}
      {modal === "changeRole" && (
        <ChangeRoleModal onClose={() => setModal("none")} onRoleChanged={() => setModal("none")} />
      )}
    </>
  );
}
```

- [ ] **Step 2: Rewrite the page as a Server Component that fetches data and renders DashboardClient**

```tsx
// app/hub/account/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import DashboardClient from "./DashboardClient";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("role_title, score, verdict, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!leads || leads.length === 0) {
    return (
      <main style={{ padding: "48px 20px", maxWidth: 640, margin: "0 auto" }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem" }}>
          No fitment scores yet
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 14 }}>
          Head back to the HUB to check your fit for a role.
        </p>
      </main>
    );
  }

  const current = leads[0];
  const prevForSameRole = leads.find((l, i) => i > 0 && l.role_title === current.role_title);

  const reportUnlocked = await isReportUnlocked(user.id, current.role_title);

  let report = null;
  if (reportUnlocked) {
    const { data: reportRow } = await supabase
      .from("fitment_reports")
      .select("strengths, gaps, cv_fixes")
      .eq("user_id", user.id)
      .eq("role_title", current.role_title)
      .maybeSingle();
    if (reportRow) {
      report = { strengths: reportRow.strengths, gaps: reportRow.gaps, cvFixes: reportRow.cv_fixes };
    }
  }

  return (
    <DashboardClient
      roleTitle={current.role_title}
      score={current.score}
      prevScore={prevForSameRole ? prevForSameRole.score : null}
      verdict={current.verdict}
      initialReportUnlocked={reportUnlocked}
      initialReport={report}
    />
  );
}
```

- [ ] **Step 3: Delete the now-unused Phase 1 bare-page markup**

The rewrite in Step 2 fully replaces the previous file content (which rendered a plain list of leads + `SignOutButton`) — confirm no other file still imports the old inline markup from `app/hub/account/page.tsx` (nothing should; `SignOutButton` is now imported by `TopBar.tsx` instead, per Task 7).

- [ ] **Step 4: Verify it type-checks and builds**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds, `/hub/account` and `/api/hub/unlock-report` and `/api/hub/rescore-role` all listed in the route output.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all files — this task touches no tested logic directly, only wires together already-tested pieces and untested UI components.

- [ ] **Step 6: Commit**

```bash
git add app/hub/account/page.tsx app/hub/account/DashboardClient.tsx
git commit -m "feat(hub): assemble dashboard shell — replaces Phase 1 bare account page"
```

---

### Task 13: Manual end-to-end verification

**Files:** none (verification only)

**Interfaces:** none.

This mirrors Phase 0's Task 9 and Phase 1's Task 8 — a real run against the live Supabase project already provisioned for this codebase (migrations `0001` and `0002` already applied there). This task requires a human to apply Task 1's migration (`0003_dashboard_report_unlock.sql`) via `psql` or the Supabase SQL Editor first, since no task in this plan applies migrations itself.

- [ ] **Step 1: Apply the migration**

A human runs `supabase/migrations/0003_dashboard_report_unlock.sql` against the live project (same method used for `0001`/`0002` — `psql` with the pooler connection string, or the Supabase SQL Editor).

- [ ] **Step 2: Run the full automated suite one more time on the final branch state**

Run: `npm test`
Expected: PASS, all files.

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Manually verify the full report-unlock flow**

With the dev server running and signed in as a test account with at least one claimed `fitment_leads` row (same account used for Phase 1's E2E verification is fine):
1. Visit `/hub/account` — confirm the score card shows the free score, the report row in the rail shows locked with "₹299", and the other 3 rows show "Coming soon".
2. Click "See my detailed report" — confirm `ReportPaywallModal` opens with the sample panel.
3. Click "Unlock full report — ₹299" — confirm the modal shows "Unlocking…", then closes; confirm the score card now shows the strengths/gaps tiles and the rail shows the report row as done with a green check; confirm the progress ring updates to reflect 2 of 5 steps.
4. Hard-reload the page — confirm the unlocked state persists (report still shows, no re-payment prompt) — this specifically verifies `report_unlocks`/`fitment_reports` are being read correctly on a fresh Server Component render, not just held in client state.
5. Click "Change" in the top bar, submit a different role + JD + CV — confirm the page updates to the new role, the score card shows the new score with no delta chip (no prior score for this role), and the report row shows locked again for the new role.
6. Change back to the original role (submit it again via "Change") — confirm the report shows unlocked again for that role (proving per-role entitlement, not a single global flag).

- [ ] **Step 4: Manually verify the 3 responsive breakpoints**

Using the browser's device toolbar (or manually resizing), check `/hub/account` at:
- ≥1200px — confirm the 3-pane-intent grid (rail + center content) renders side by side without horizontal scroll.
- 880–1199px and ≤879px — per the design README's binding mobile spec, confirm no horizontal scroll and all interactive elements (rail rows, buttons, modal) remain usable at 320px width minimum. This plan's components use CSS grid with `minmax(0,1fr)` and flex-wrap in the score card specifically to avoid overflow — if any element causes horizontal scroll at a breakpoint, that's a real bug to fix before calling this task done, not a deferred cosmetic issue.

- [ ] **Step 5: Record the outcome**

No code changes in this task — its only artifact is confirming the above all pass, recorded in the subagent-driven-development progress ledger (`.superpowers/sdd/progress.md`) alongside the rest of this phase's task history.
