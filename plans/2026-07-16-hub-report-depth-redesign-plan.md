# Merito HUB Phase 2b: Detailed Report Depth Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the detailed fitment report's thin 3-array content (strengths/gaps/cvFixes) with a JD-requirement rubric, CV-evidence quotes, and a prioritized action plan, surfaced in a new dedicated `/hub/account/report` page.

**Architecture:** `lib/generateFitmentReport.ts`'s Claude call and output schema change; a new migration alters the already-live `fitment_reports` table to match; every existing consumer of the old shape (`app/api/hub/unlock-report/route.ts`, `ScoreCard.tsx`, `ReportPaywallModal.tsx`, `DashboardClient.tsx`, `app/hub/account/page.tsx`) is updated to the new type; two new presentational components and a new Server Component page render the full breakdown.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4 (inline styles for exact design-token values), Supabase (Postgres, jsonb columns), Anthropic Claude Haiku 4.5 (structured output via `zodOutputFormat`), Vitest.

## Global Constraints

- New schema, exported from `lib/generateFitmentReport.ts` and imported everywhere else that needs it (never redefined ad-hoc in a consuming file):
  ```ts
  export type FitmentReportResult = {
    requirements: {
      requirement: string;
      matchLevel: "strong" | "partial" | "missing";
      evidence: string;
      note: string;
    }[];
    actionPlan: { priority: number; action: string; why: string }[];
  };
  ```
- `evidence` is either a real quote from the CV or the literal string `"Not found in CV"` — this exact string is what UI code checks against to decide whether to render the evidence blockquote or a plain fallback line.
- Design tokens (from the approved spec): Strong = `#16803c` text on `#eefdf1` background (existing tokens); Partial = new amber `#b45309` text on `#fef3e2` background; Missing = `#ed1a24` text on `#fdeced` background (existing tokens). Gabarito for headings, Poppins for body (both already loaded globally, no new font setup).
- The report unlock/paywall/entitlement mechanics (`lib/reportUnlocks.ts`, the fake-pay flow, `report_unlocks` table, pricing) are UNCHANGED by this plan — do not touch them.
- No automated tests for `RequirementRow.tsx`, `ActionPlanItem.tsx`, `app/hub/account/report/page.tsx`, or the `ScoreCard.tsx`/`ReportPaywallModal.tsx`/`DashboardClient.tsx`/`app/hub/account/page.tsx` type updates — this repo has no component/browser test infrastructure. `lib/generateFitmentReport.ts` and `app/api/hub/unlock-report/route.ts` DO get real unit tests, as updates to their existing test files.
- Migration is written to `supabase/migrations/` but NOT applied by any task — a human applies it via `psql` or the Supabase SQL Editor against the live project (same precedent as every prior migration).

---

### Task 1: Database migration — fitment_reports rubric schema

**Files:**
- Create: `supabase/migrations/0004_fitment_reports_rubric.sql`

**Interfaces:**
- Produces: `fitment_reports.requirements jsonb`, `fitment_reports.action_plan jsonb` (replacing the dropped `strengths`, `gaps`, `cv_fixes` text[] columns). Task 3's route upserts into these exact column names; Task 7's page reads them.

- [ ] **Step 1: Write the migration**

```sql
alter table fitment_reports
  drop column if exists strengths,
  drop column if exists gaps,
  drop column if exists cv_fixes;

alter table fitment_reports
  add column if not exists requirements jsonb not null default '[]'::jsonb,
  add column if not exists action_plan jsonb not null default '[]'::jsonb;
```

- [ ] **Step 2: Verify by reading the file back**

No automated test (no live Postgres in this environment — a human applies it later). Confirm: `drop column if exists` and `add column if not exists` make this safe to re-run; the RLS policy from migration `0003` is untouched (it scopes on `auth.uid() = user_id`, not specific columns, so no policy changes are needed here).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_fitment_reports_rubric.sql
git commit -m "feat(hub): migrate fitment_reports to requirements/action_plan jsonb schema"
```

---

### Task 2: lib/generateFitmentReport.ts — rubric + action plan schema

**Files:**
- Modify: `lib/generateFitmentReport.ts`
- Modify: `lib/__tests__/generateFitmentReport.test.ts`

**Interfaces:**
- Produces: `export type FitmentReportResult = { requirements: {...}[]; actionPlan: {...}[] }` (replacing the old `{strengths, gaps, cvFixes}` shape) and `export async function generateFitmentReport(jdText: string, cvText: string, score: number): Promise<FitmentReportResult>` (same signature, same 3 args — callers are unaffected by the signature, only the return shape changes). Task 3's route, and Tasks 4/7's UI code, all import `FitmentReportResult` from this file.

- [ ] **Step 1: Replace the test file**

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

  it("returns the parsed requirements and action plan from Claude", async () => {
    parseMock.mockResolvedValue({
      parsed_output: {
        requirements: [
          {
            requirement: "5+ years React experience",
            matchLevel: "strong",
            evidence: "Led React frontend rewrite for 3 years at Acme Corp",
            note: "Directly demonstrates senior-level React experience.",
          },
          {
            requirement: "Team leadership experience",
            matchLevel: "missing",
            evidence: "Not found in CV",
            note: "No mention of managing or leading a team.",
          },
        ],
        actionPlan: [
          {
            priority: 1,
            action: "Add a leadership example to your CV",
            why: "This is the JD's top unmet requirement.",
          },
          {
            priority: 2,
            action: "Quantify your React project's impact",
            why: "Numbers make strong matches more convincing.",
          },
        ],
      },
    });
    const { generateFitmentReport } = await import("../generateFitmentReport");
    const result = await generateFitmentReport("Senior PM JD text", "CV text", 7.8);

    expect(result.requirements).toHaveLength(2);
    expect(result.requirements[0]).toEqual({
      requirement: "5+ years React experience",
      matchLevel: "strong",
      evidence: "Led React frontend rewrite for 3 years at Acme Corp",
      note: "Directly demonstrates senior-level React experience.",
    });
    expect(result.actionPlan).toHaveLength(2);
    expect(result.actionPlan[0].priority).toBe(1);
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
Expected: FAIL — the current implementation returns `{strengths, gaps, cvFixes}`, not `{requirements, actionPlan}`, so `result.requirements` is `undefined`.

- [ ] **Step 3: Replace the implementation**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export type FitmentReportResult = {
  requirements: {
    requirement: string;
    matchLevel: "strong" | "partial" | "missing";
    evidence: string;
    note: string;
  }[];
  actionPlan: { priority: number; action: string; why: string }[];
};

const FitmentReportSchema = z.object({
  requirements: z
    .array(
      z.object({
        requirement: z.string(),
        matchLevel: z.enum(["strong", "partial", "missing"]),
        evidence: z.string(),
        note: z.string(),
      })
    )
    .min(1),
  actionPlan: z
    .array(
      z.object({
        priority: z.number(),
        action: z.string(),
        why: z.string(),
      })
    )
    .min(1),
});

export async function generateFitmentReport(
  jdText: string,
  cvText: string,
  score: number
): Promise<FitmentReportResult> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content:
          "You are writing a detailed fitment analysis for a candidate who scored " +
          `${score}/10 against a job description.\n\n` +
          `Job description:\n${jdText}\n\n` +
          `Candidate CV:\n${cvText}\n\n` +
          "First, parse the job description into its distinct requirements " +
          "(skills, experience levels, qualifications, responsibilities). For each " +
          'requirement, assess the candidate\'s match as "strong", "partial", or ' +
          '"missing", quote the exact line(s) from the CV that support your ' +
          'assessment as evidence (or write exactly "Not found in CV" if there is ' +
          "no supporting evidence), and add a one-sentence note explaining the " +
          "assessment. Cover every distinct requirement you can identify in the JD.\n\n" +
          "Then write a prioritized action plan: 3-5 concrete, ordered steps the " +
          "candidate should take to improve their fit, each with a one-sentence " +
          "explanation of why it matters, ordered by priority (1 = do this first).",
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
git commit -m "feat(hub): redesign generateFitmentReport as JD-requirement rubric + action plan"
```

---

### Task 3: app/api/hub/unlock-report/route.ts — update to new payload shape

**Files:**
- Modify: `app/api/hub/unlock-report/route.ts`
- Modify: `app/api/hub/unlock-report/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `FitmentReportResult` from `@/lib/generateFitmentReport` (Task 2).
- Produces: unchanged route contract — `POST /api/hub/unlock-report` still returns `{status: "unlocked", report: FitmentReportResult}` or `{status: "needs_cv"}` or `{error: string}`. Only the shape of `report` and the `fitment_reports` upsert payload change. Task 4's `ReportPaywallModal.tsx` consumes this response.

- [ ] **Step 1: Update the test file's report-shape assertions**

In `app/api/hub/unlock-report/__tests__/route.test.ts`, the `"unlocks and generates the report when CV text is on file"` test currently mocks `generateFitmentReportMock` with the old shape and asserts the old upsert payload. Replace that test's body with:

```typescript
  it("unlocks and generates the report when CV text is on file", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({
      data: { jd_text: "JD text", cv_text: "CV text", score: 7.8 },
      error: null,
    });
    unlockReportMock.mockResolvedValue(undefined);
    generateFitmentReportMock.mockResolvedValue({
      requirements: [
        {
          requirement: "React",
          matchLevel: "strong",
          evidence: "3 years React",
          note: "Good match.",
        },
      ],
      actionPlan: [{ priority: 1, action: "Add metrics", why: "Numbers persuade." }],
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
        requirements: [
          {
            requirement: "React",
            matchLevel: "strong",
            evidence: "3 years React",
            note: "Good match.",
          },
        ],
        action_plan: [{ priority: 1, action: "Add metrics", why: "Numbers persuade." }],
      },
      { onConflict: "user_id,role_title" }
    );
    expect(body).toEqual({
      status: "unlocked",
      report: {
        requirements: [
          {
            requirement: "React",
            matchLevel: "strong",
            evidence: "3 years React",
            note: "Good match.",
          },
        ],
        actionPlan: [{ priority: 1, action: "Add metrics", why: "Numbers persuade." }],
      },
    });
  });
```

The other four tests (`401`, `400 missing roleTitle`, `400 no matching lead`, `needs_cv`) don't reference the report shape and stay unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/hub/unlock-report/__tests__/route.test.ts`
Expected: FAIL — the route still upserts `strengths`/`gaps`/`cv_fixes`, not `requirements`/`action_plan`.

- [ ] **Step 3: Update the route's upsert payload**

In `app/api/hub/unlock-report/route.ts`, this block:

```typescript
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
```

becomes:

```typescript
  const admin = getSupabaseServerClient();
  const { error: reportError } = await admin.from("fitment_reports").upsert(
    {
      user_id: user.id,
      role_title: roleTitle,
      requirements: report.requirements,
      action_plan: report.actionPlan,
    },
    { onConflict: "user_id,role_title" }
  );
```

Nothing else in the route changes — the `generateFitmentReport(lead.jd_text, lead.cv_text, lead.score)` call site is unaffected since only its return type changed, not its signature.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/hub/unlock-report/__tests__/route.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/unlock-report/route.ts app/api/hub/unlock-report/__tests__/route.test.ts
git commit -m "feat(hub): update unlock-report route to requirements/action_plan payload"
```

---

### Task 4: Update all existing consumers of the old report shape

**Files:**
- Modify: `app/hub/account/ScoreCard.tsx`
- Modify: `app/hub/account/ReportPaywallModal.tsx`
- Modify: `app/hub/account/DashboardClient.tsx`
- Modify: `app/hub/account/page.tsx`

**Interfaces:**
- Consumes: `FitmentReportResult` from `@/lib/generateFitmentReport` (Task 2).
- Produces: `ScoreCard`'s `report` prop type changes from the old inline shape to `FitmentReportResult | null`; `ReportPaywallModal`'s `onUnlocked` prop type changes to `(report: FitmentReportResult) => void`; `DashboardClient`'s local `ReportData` type alias is removed in favor of importing `FitmentReportResult` directly. Task 7 (the new report page) independently re-reads `fitment_reports` itself and does not depend on this task's components, but relies on `app/hub/account/page.tsx`'s query change here for consistency (both read the same new columns).

This is a coordinated type-consistency update across four files that all reference the old `{strengths, gaps, cvFixes}` shape — none of them have independent test cycles (no automated tests exist for any of the four), so they're grouped into one task, verified together via `tsc` + `npm run build`.

- [ ] **Step 1: Update `app/hub/account/ScoreCard.tsx`**

Add the import at the top of the file:

```typescript
import Link from "next/link";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
```

Change the prop type from:

```typescript
  report: { strengths: string[]; gaps: string[]; cvFixes: string[] } | null;
```

to:

```typescript
  report: FitmentReportResult | null;
```

Replace the entire `) : report ? ( ... )` branch (the unlocked-with-report JSX block, currently rendering two tiles of `report.strengths.slice(0, 2)` / `report.gaps.slice(0, 2)`) with:

```tsx
      ) : report ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {report.requirements.find((r) => r.matchLevel === "strong") && (
              <div
                className="bg-[#eefdf1]"
                style={{ borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  className="bg-[#16803c] text-white font-[family-name:var(--font-poppins)] font-bold"
                  style={{ borderRadius: 50, padding: "2px 8px", fontSize: 10 }}
                >
                  Strong
                </span>
                <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5 }}>
                  {report.requirements.find((r) => r.matchLevel === "strong")?.requirement}
                </span>
              </div>
            )}
            {report.requirements.find((r) => r.matchLevel === "missing") && (
              <div
                className="bg-[#fdeced]"
                style={{ borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  className="bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold"
                  style={{ borderRadius: 50, padding: "2px 8px", fontSize: 10 }}
                >
                  Missing
                </span>
                <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5 }}>
                  {report.requirements.find((r) => r.matchLevel === "missing")?.requirement}
                </span>
              </div>
            )}
          </div>
          <Link
            href="/hub/account/report"
            className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
            style={{ fontSize: 13, display: "inline-block", marginTop: 12 }}
          >
            Open full report →
          </Link>
        </div>
      ) : (
```

Everything else in the file (the locked-state block, the score/verdict/progress-bar rendering above it, the final "generating" fallback) is unchanged.

- [ ] **Step 2: Update `app/hub/account/ReportPaywallModal.tsx`**

Add the import at the top:

```typescript
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
```

Change the prop type from:

```typescript
  onUnlocked: (report: { strengths: string[]; gaps: string[]; cvFixes: string[] }) => void;
```

to:

```typescript
  onUnlocked: (report: FitmentReportResult) => void;
```

Nothing else in this file changes — it already just forwards `data.report` from the fetch response to `onUnlocked` without inspecting its contents.

- [ ] **Step 3: Update `app/hub/account/DashboardClient.tsx`**

Remove the local type alias:

```typescript
type ReportData = { strengths: string[]; gaps: string[]; cvFixes: string[] };
```

Add this import instead:

```typescript
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
```

Replace every occurrence of `ReportData` in this file (the `initialReport` prop type and the `useState<ReportData | null>` call) with `FitmentReportResult`. Nothing else changes — the component only passes the value through, it doesn't inspect its shape.

- [ ] **Step 4: Update `app/hub/account/page.tsx`**

Add the import at the top:

```typescript
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
```

Replace this block:

```typescript
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
```

with:

```typescript
  let report: FitmentReportResult | null = null;
  if (reportUnlocked) {
    const { data: reportRow } = await supabase
      .from("fitment_reports")
      .select("requirements, action_plan")
      .eq("user_id", user.id)
      .eq("role_title", current.role_title)
      .maybeSingle();
    if (reportRow) {
      report = { requirements: reportRow.requirements, actionPlan: reportRow.action_plan };
    }
  }
```

- [ ] **Step 5: Verify with tsc and a full build**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors — this is the real check here, since all four files' types must now agree with each other and with `FitmentReportResult`.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 7: Commit**

```bash
git add app/hub/account/ScoreCard.tsx app/hub/account/ReportPaywallModal.tsx app/hub/account/DashboardClient.tsx app/hub/account/page.tsx
git commit -m "feat(hub): update dashboard components to requirements/action_plan report shape"
```

---

### Task 5: app/hub/account/report/RequirementRow.tsx

**Files:**
- Create: `app/hub/account/report/RequirementRow.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (receives data as props).
- Produces: `export default function RequirementRow({ requirement, matchLevel, evidence, note }: { requirement: string; matchLevel: "strong" | "partial" | "missing"; evidence: string; note: string })`. Task 7 renders one of these per entry in `FitmentReportResult["requirements"]`.

- [ ] **Step 1: Write the component**

```tsx
export default function RequirementRow({
  requirement,
  matchLevel,
  evidence,
  note,
}: {
  requirement: string;
  matchLevel: "strong" | "partial" | "missing";
  evidence: string;
  note: string;
}) {
  const chipStyles = {
    strong: { bg: "#eefdf1", fg: "#16803c", label: "Strong match" },
    partial: { bg: "#fef3e2", fg: "#b45309", label: "Partial match" },
    missing: { bg: "#fdeced", fg: "#ed1a24", label: "Missing" },
  }[matchLevel];

  const hasEvidence = evidence !== "Not found in CV";

  return (
    <div
      className="bg-white border border-black/[0.08]"
      style={{ borderRadius: 14, padding: 18, marginBottom: 14 }}
    >
      <div className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 10 }}>
        <span
          className="font-[family-name:var(--font-poppins)] font-bold"
          style={{ background: chipStyles.bg, color: chipStyles.fg, borderRadius: 50, padding: "3px 10px", fontSize: 11 }}
        >
          {chipStyles.label}
        </span>
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14 }}>
          {requirement}
        </span>
      </div>

      {hasEvidence ? (
        <div
          style={{
            borderLeft: `3px solid ${chipStyles.fg}`,
            background: chipStyles.bg,
            borderRadius: "0 8px 8px 0",
            padding: "10px 14px",
            marginBottom: 10,
          }}
        >
          <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13, fontStyle: "italic", color: "#4b4b4d", margin: 0 }}>
            &ldquo;{evidence}&rdquo;
          </p>
          <p
            className="font-[family-name:var(--font-poppins)] font-semibold uppercase"
            style={{ fontSize: 10, letterSpacing: "0.06em", color: "#9c9c9c", margin: "6px 0 0" }}
          >
            — from your CV
          </p>
        </div>
      ) : (
        <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13, color: "#9c9c9c", fontStyle: "italic", margin: "0 0 10px" }}>
          Not found in your CV.
        </p>
      )}

      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        {note}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors referencing `RequirementRow.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/hub/account/report/RequirementRow.tsx
git commit -m "feat(hub): add RequirementRow component for full report page"
```

---

### Task 6: app/hub/account/report/ActionPlanItem.tsx

**Files:**
- Create: `app/hub/account/report/ActionPlanItem.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export default function ActionPlanItem({ priority, action, why }: { priority: number; action: string; why: string })`. Task 7 renders one of these per entry in `FitmentReportResult["actionPlan"]`.

- [ ] **Step 1: Write the component**

```tsx
export default function ActionPlanItem({
  priority,
  action,
  why,
}: {
  priority: number;
  action: string;
  why: string;
}) {
  const isTop = priority === 1;

  return (
    <div className="flex items-start" style={{ gap: 14, marginBottom: 16 }}>
      <div
        className="font-[family-name:var(--font-gabarito)] font-bold flex items-center justify-center flex-shrink-0"
        style={{
          width: isTop ? 34 : 28,
          height: isTop ? 34 : 28,
          borderRadius: "50%",
          fontSize: isTop ? 15 : 13,
          background: isTop ? "#ed1a24" : "transparent",
          color: isTop ? "#fff" : "#9c9c9c",
          border: isTop ? "none" : "1.5px solid #dcdcdc",
        }}
      >
        {priority}
      </div>
      <div>
        <p
          className="font-[family-name:var(--font-poppins)] font-semibold text-black"
          style={{ fontSize: isTop ? 15 : 13.5, margin: 0 }}
        >
          {action}
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, margin: "4px 0 0", lineHeight: 1.5 }}>
          {why}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors referencing `ActionPlanItem.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/hub/account/report/ActionPlanItem.tsx
git commit -m "feat(hub): add ActionPlanItem component for full report page"
```

---

### Task 7: app/hub/account/report/page.tsx — the full report view

**Files:**
- Create: `app/hub/account/report/page.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient` from `@/lib/supabaseAuthServer`, `isReportUnlocked` from `@/lib/reportUnlocks`, `FitmentReportResult` from `@/lib/generateFitmentReport`, `RequirementRow` (Task 5), `ActionPlanItem` (Task 6).
- Produces: the `/hub/account/report` route.

- [ ] **Step 1: Write the page**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
import RequirementRow from "./RequirementRow";
import ActionPlanItem from "./ActionPlanItem";

export default async function FullReportPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("role_title, score")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!leads || leads.length === 0) {
    redirect("/hub/account");
  }

  const current = leads[0];
  const unlocked = await isReportUnlocked(user.id, current.role_title);

  if (!unlocked) {
    redirect("/hub/account");
  }

  const { data: reportRow } = await supabase
    .from("fitment_reports")
    .select("requirements, action_plan")
    .eq("user_id", user.id)
    .eq("role_title", current.role_title)
    .maybeSingle();

  if (!reportRow) {
    redirect("/hub/account");
  }

  const sortedActionPlan = [...reportRow.action_plan].sort(
    (a: FitmentReportResult["actionPlan"][number], b: FitmentReportResult["actionPlan"][number]) =>
      a.priority - b.priority
  );

  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "48px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 820 }}>
        <Link
          href="/hub/account"
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ fontSize: 13 }}
        >
          ← Back to dashboard
        </Link>

        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.8rem", margin: "14px 0 4px" }}>
          Your detailed fitment report
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, margin: "0 0 28px" }}>
          {current.score.toFixed(1)} / 10 fit for {current.role_title}
        </p>

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "0 0 14px" }}>
          Match breakdown
        </h2>
        {reportRow.requirements.map((r: FitmentReportResult["requirements"][number], i: number) => (
          <RequirementRow key={i} requirement={r.requirement} matchLevel={r.matchLevel} evidence={r.evidence} note={r.note} />
        ))}

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "32px 0 14px" }}>
          Your action plan
        </h2>
        {sortedActionPlan.map((item: FitmentReportResult["actionPlan"][number], i: number) => (
          <ActionPlanItem key={i} priority={item.priority} action={item.action} why={item.why} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify with tsc and a full build**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

Run: `npm run build`
Expected: succeeds, `/hub/account/report` listed as a dynamic route in the output.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/report/page.tsx
git commit -m "feat(hub): add full report page with rubric and action plan"
```

---

### Task 8: Manual end-to-end verification

**Files:** none (verification only)

**Interfaces:** none.

This mirrors Phase 2's own Task 13 — a real run against the same live Supabase project already used for Phase 0/1/2's E2E testing. Requires a human to apply Task 1's migration first, since no task in this plan applies it itself.

- [ ] **Step 1: Apply the migration**

A human runs `supabase/migrations/0004_fitment_reports_rubric.sql` against the live project.

- [ ] **Step 2: Run the full automated suite one more time on the final branch state**

Run: `npm test` — expect PASS, all files.
Run: `./node_modules/.bin/tsc --noEmit -p .` — expect no errors.
Run: `npm run build` — expect success.

- [ ] **Step 3: Manually verify the redesigned report content and the new page**

With the dev server running and signed in as a test account with a claimed `fitment_leads` row that has `cv_text` on file (from a real anonymous check, per Phase 2's Task 5):
1. If the report is already unlocked from a prior test (under the old schema), trigger a free CV re-check first to regenerate it under the new schema — otherwise the old row's `requirements`/`action_plan` will read as empty (per this plan's accepted no-backfill decision).
2. On `/hub/account`, confirm `ScoreCard`'s teaser shows one "Strong" chip and one "Missing" chip (or gracefully shows just one if the report doesn't have both), each with real requirement text, plus an "Open full report →" link.
3. Click through to `/hub/account/report` — confirm every requirement from the JD renders as its own row, each with a match-level chip in the correct color (green/amber/red), an evidence blockquote with a real CV quote (or the "Not found in your CV" fallback when appropriate), and an assessment note.
4. Confirm the action plan section renders below, priority-ordered, with priority 1 visually larger/filled and lower priorities visually smaller/outlined.
5. Navigate directly to `/hub/account/report` via URL while signed out (or in a different account with no unlock) — confirm it redirects to `/hub/account` rather than erroring or exposing the report.

- [ ] **Step 4: Record the outcome**

No code changes in this task — record the outcome in `.superpowers/sdd/progress.md`, same as Phase 2's own Task 13.
