# Merito HUB Phase 2c: Detailed Report Value & Structure Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 21-row requirement list with category-grouped sections, a verdict summary paragraph, must-have/nice-to-have tags, interview notes, effort-tagged action items, and a document-style header — while keeping every gap fully visible (no filtering, no positive-only mode).

**Architecture:** `lib/generateFitmentReport.ts`'s schema is redesigned again to nest requirements under categories and add narrative/coaching fields; a migration renames and extends the already-live `fitment_reports` table and adds a `name` column to `fitment_leads`; the anonymous check form gains a name field; every existing consumer of the report shape is updated; two report-page components are extended and one new one is added; the report page itself is rewritten around the new structure.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4 (inline styles), Supabase (Postgres, jsonb), Anthropic Claude Haiku 4.5 (`zodOutputFormat`), Vitest.

## Global Constraints

- New schema, exported from `lib/generateFitmentReport.ts`, imported everywhere it's needed:
  ```ts
  export type FitmentReportResult = {
    verdictSummary: string;
    categories: {
      category: "Technical Skills" | "Experience" | "Tools & Platforms" | "Soft Skills";
      matchedCount: number;
      totalCount: number;
      requirements: {
        requirement: string;
        matchLevel: "strong" | "partial" | "missing";
        isMustHave: boolean;
        evidence: string;
        note: string;
        interviewNote: string;
      }[];
    }[];
    actionPlan: { priority: number; action: string; why: string; effort: "quick" | "moderate" | "long-term" }[];
  };
  ```
- **Full transparency is non-negotiable in this build**: every requirement — every match level, every must-have/nice-to-have status — renders somewhere. No task in this plan filters or hides content; a positive-only view is explicitly out of scope.
- `fitment_reports`'s DB column holding the requirement data is **renamed** from `requirements` to `categories` in this phase's migration, since its content shape fundamentally changed — this is a deliberate naming-clarity fix, not left as a stale mismatched name. The rename must be idempotent (safe to re-run).
- `fitment_leads.name` is nullable — the anonymous check form's new name field is NOT required, and every consumer of it must fall back gracefully (to the account's email) when null.
- No automated tests for `RequirementRow.tsx`, `ActionPlanItem.tsx`, `CategorySection.tsx`, `app/hub/account/report/page.tsx`, `ScoreCard.tsx`'s update, `app/hub/account/page.tsx`'s update, or `FitmentChecker.tsx`'s new field — this repo has no component/browser test infrastructure. `lib/generateFitmentReport.ts`, `app/api/hub/unlock-report/route.ts`, and `app/api/hub/fitment-check/route.ts` DO get real unit test updates.
- Migration is written to `supabase/migrations/` but NOT applied by any task — a human applies it against the live project, same precedent as every prior migration.

---

### Task 1: Database migration — categories rename, verdict_summary, name

**Files:**
- Create: `supabase/migrations/0005_fitment_reports_categories.sql`

**Interfaces:**
- Produces: `fitment_reports.categories` (renamed from `requirements`), `fitment_reports.verdict_summary text`, `fitment_leads.name text`. Task 3's route upserts into `categories`/`verdict_summary`; Task 4's route inserts into `fitment_leads.name`.

- [ ] **Step 1: Write the migration**

```sql
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'fitment_reports' and column_name = 'requirements'
  ) then
    alter table fitment_reports rename column requirements to categories;
  end if;
end $$;

alter table fitment_reports
  add column if not exists verdict_summary text not null default '';

alter table fitment_leads
  add column if not exists name text;
```

- [ ] **Step 2: Verify by reading the file back**

No automated test (no live Postgres here). Confirm: the `do $$ ... $$` block only renames the column if it still has its old name, so re-running the file after the rename already happened finds nothing to rename and does nothing — safe to re-run. `add column if not exists` guards the other two additions the same way as every prior migration.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_fitment_reports_categories.sql
git commit -m "feat(hub): migrate fitment_reports to categories schema, add fitment_leads.name"
```

---

### Task 2: lib/generateFitmentReport.ts — verdict, categories, interview notes, effort

**Files:**
- Modify: `lib/generateFitmentReport.ts`
- Modify: `lib/__tests__/generateFitmentReport.test.ts`

**Interfaces:**
- Produces: `FitmentReportResult` as defined in Global Constraints, and `generateFitmentReport(jdText: string, cvText: string, score: number): Promise<FitmentReportResult>` — same signature as before, only the return shape's internals change again. Task 3's route and Tasks 5/6/7/8/9's UI code all import this type.

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

  it("returns the parsed verdict summary, categories, and action plan from Claude", async () => {
    parseMock.mockResolvedValue({
      parsed_output: {
        verdictSummary: "This candidate is a strong technical fit with a gap in leadership experience.",
        categories: [
          {
            category: "Technical Skills",
            matchedCount: 1,
            totalCount: 1,
            requirements: [
              {
                requirement: "5+ years React experience",
                matchLevel: "strong",
                isMustHave: true,
                evidence: "Led React frontend rewrite for 3 years at Acme Corp",
                note: "Directly demonstrates senior-level React experience.",
                interviewNote: "Lead with this project when asked about your React background.",
              },
            ],
          },
          {
            category: "Experience",
            matchedCount: 0,
            totalCount: 1,
            requirements: [
              {
                requirement: "Team leadership experience",
                matchLevel: "missing",
                isMustHave: false,
                evidence: "Not found in CV",
                note: "No mention of managing or leading a team.",
                interviewNote: "If asked, mention any informal mentoring or project ownership you've taken on.",
              },
            ],
          },
        ],
        actionPlan: [
          {
            priority: 1,
            action: "Add a leadership example to your CV",
            why: "This is the JD's top unmet requirement.",
            effort: "moderate",
          },
        ],
      },
    });
    const { generateFitmentReport } = await import("../generateFitmentReport");
    const result = await generateFitmentReport("Senior PM JD text", "CV text", 7.8);

    expect(result.verdictSummary).toContain("strong technical fit");
    expect(result.categories).toHaveLength(2);
    expect(result.categories[0].matchedCount).toBe(1);
    expect(result.categories[0].requirements[0].isMustHave).toBe(true);
    expect(result.actionPlan[0].effort).toBe("moderate");
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
Expected: FAIL — the current implementation returns the flat `{requirements, actionPlan}` shape from Phase 2b, not `{verdictSummary, categories, actionPlan}`.

- [ ] **Step 3: Replace the implementation**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export type FitmentReportResult = {
  verdictSummary: string;
  categories: {
    category: "Technical Skills" | "Experience" | "Tools & Platforms" | "Soft Skills";
    matchedCount: number;
    totalCount: number;
    requirements: {
      requirement: string;
      matchLevel: "strong" | "partial" | "missing";
      isMustHave: boolean;
      evidence: string;
      note: string;
      interviewNote: string;
    }[];
  }[];
  actionPlan: { priority: number; action: string; why: string; effort: "quick" | "moderate" | "long-term" }[];
};

const FitmentReportSchema = z.object({
  verdictSummary: z.string(),
  categories: z
    .array(
      z.object({
        category: z.enum(["Technical Skills", "Experience", "Tools & Platforms", "Soft Skills"]),
        matchedCount: z.number(),
        totalCount: z.number(),
        requirements: z
          .array(
            z.object({
              requirement: z.string(),
              matchLevel: z.enum(["strong", "partial", "missing"]),
              isMustHave: z.boolean(),
              evidence: z.string(),
              note: z.string(),
              interviewNote: z.string(),
            })
          )
          .min(1),
      })
    )
    .min(1),
  actionPlan: z
    .array(
      z.object({
        priority: z.number(),
        action: z.string(),
        why: z.string(),
        effort: z.enum(["quick", "moderate", "long-term"]),
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
    max_tokens: 3072,
    messages: [
      {
        role: "user",
        content:
          "You are writing a structured fitment assessment for a candidate who scored " +
          `${score}/10 against a job description.\n\n` +
          `Job description:\n${jdText}\n\n` +
          `Candidate CV:\n${cvText}\n\n` +
          "First, write a one-paragraph verdict summary: a narrative assessment of this " +
          "candidate's overall fit, written the way a human assessor would summarize their " +
          "findings before the details.\n\n" +
          "Then parse the job description's requirements and group them into exactly these " +
          'four categories: "Technical Skills", "Experience", "Tools & Platforms", ' +
          '"Soft Skills". Only include a category if the JD has requirements that fit it. ' +
          "For each category, report matchedCount (requirements assessed strong or partial) " +
          "and totalCount (all requirements in that category).\n\n" +
          "For each individual requirement: mark isMustHave true if the JD treats it as a " +
          "core/required qualification, false if it's listed as a bonus, preferred, or " +
          '"nice to have". Assess matchLevel as "strong", "partial", or "missing". Quote ' +
          'the exact line(s) from the CV as evidence (or write exactly "Not found in CV" ' +
          "if there is none). Write a one-sentence note explaining the assessment. Then " +
          "write a separate interviewNote: for a strong match, a tip on how to emphasize it " +
          "in an interview; for a partial or missing match, a tip on how to address it if " +
          "asked about it.\n\n" +
          "Finally, write a prioritized action plan: 3-5 concrete, ordered steps to improve " +
          'fit, each with a one-sentence why it matters, and an effort tag of "quick" ' +
          '(can do today), "moderate" (a focused week of work), or "long-term" (requires ' +
          "real experience over months), ordered by priority (1 = do this first). " +
          "Prioritize must-have gaps over nice-to-have gaps.",
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
git commit -m "feat(hub): redesign generateFitmentReport with verdict summary, categories, interview notes"
```

---

### Task 3: app/api/hub/unlock-report/route.ts — update to new payload shape

**Files:**
- Modify: `app/api/hub/unlock-report/route.ts`
- Modify: `app/api/hub/unlock-report/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `FitmentReportResult` from `@/lib/generateFitmentReport` (Task 2).
- Produces: unchanged route contract — same 401/400/500/200 response shapes, only the `report` payload's internals and the `fitment_reports` upsert columns change.

- [ ] **Step 1: Update the test's report-shape assertions**

In `app/api/hub/unlock-report/__tests__/route.test.ts`, replace the `"unlocks and generates the report when CV text is on file"` test's body with:

```typescript
  it("unlocks and generates the report when CV text is on file", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({
      data: { jd_text: "JD text", cv_text: "CV text", score: 7.8 },
      error: null,
    });
    unlockReportMock.mockResolvedValue(undefined);
    generateFitmentReportMock.mockResolvedValue({
      verdictSummary: "Strong overall fit.",
      categories: [
        {
          category: "Technical Skills",
          matchedCount: 1,
          totalCount: 1,
          requirements: [
            {
              requirement: "React",
              matchLevel: "strong",
              isMustHave: true,
              evidence: "3 years React",
              note: "Good match.",
              interviewNote: "Mention this project first.",
            },
          ],
        },
      ],
      actionPlan: [{ priority: 1, action: "Add metrics", why: "Numbers persuade.", effort: "quick" }],
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
        verdict_summary: "Strong overall fit.",
        categories: [
          {
            category: "Technical Skills",
            matchedCount: 1,
            totalCount: 1,
            requirements: [
              {
                requirement: "React",
                matchLevel: "strong",
                isMustHave: true,
                evidence: "3 years React",
                note: "Good match.",
                interviewNote: "Mention this project first.",
              },
            ],
          },
        ],
        action_plan: [{ priority: 1, action: "Add metrics", why: "Numbers persuade.", effort: "quick" }],
      },
      { onConflict: "user_id,role_title" }
    );
    expect(body.status).toBe("unlocked");
    expect(body.report.verdictSummary).toBe("Strong overall fit.");
  });
```

The other four tests (`401`, `400 missing roleTitle`, `400 no matching lead`, `needs_cv`) don't reference the report shape and stay unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/hub/unlock-report/__tests__/route.test.ts`
Expected: FAIL — the route still upserts `requirements`/`action_plan` without `verdict_summary`/`categories`.

- [ ] **Step 3: Update the route's upsert payload**

In `app/api/hub/unlock-report/route.ts`, this block:

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

becomes:

```typescript
  const admin = getSupabaseServerClient();
  const { error: reportError } = await admin.from("fitment_reports").upsert(
    {
      user_id: user.id,
      role_title: roleTitle,
      verdict_summary: report.verdictSummary,
      categories: report.categories,
      action_plan: report.actionPlan,
    },
    { onConflict: "user_id,role_title" }
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/hub/unlock-report/__tests__/route.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/unlock-report/route.ts app/api/hub/unlock-report/__tests__/route.test.ts
git commit -m "feat(hub): update unlock-report route to verdict_summary/categories payload"
```

---

### Task 4: Full name field — FitmentChecker.tsx + fitment-check route

**Files:**
- Modify: `app/hub/FitmentChecker.tsx`
- Modify: `app/api/hub/fitment-check/route.ts`
- Modify: `app/api/hub/fitment-check/__tests__/route.test.ts`

**Interfaces:**
- Produces: `fitment_leads.name` is populated (nullable) on every anonymous check going forward.

- [ ] **Step 1: Update the test file**

In `app/api/hub/fitment-check/__tests__/route.test.ts`, add `name` to the `buildForm` helper's defaults:

```typescript
function buildForm(overrides: Record<string, string | Blob> = {}) {
  const form = new FormData();
  form.set("name", "Jane Doe");
  form.set("email", "candidate@example.com");
  form.set("role", "Senior Product Manager");
  form.set("jdText", "We need a PM who can ship.");
  form.set("recaptchaToken", "token-123");
  form.set("cv", new Blob(["cv bytes"], { type: "application/pdf" }), "resume.pdf");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}
```

Update the `"returns 200 with the score for a valid submission"` test's assertion to also check `name` was inserted:

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
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ name: "Jane Doe" }));
  });
```

Add a new test confirming a missing name doesn't block submission and stores `null`:

```typescript
  it("succeeds without a name, storing it as null", async () => {
    const form = buildForm();
    form.delete("name");
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: form,
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ name: null }));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/hub/fitment-check/__tests__/route.test.ts`
Expected: FAIL — the route doesn't read or store `name` yet.

- [ ] **Step 3: Update the route**

In `app/api/hub/fitment-check/route.ts`, this line:

```typescript
  const email = normalize(form.get("email"));
```

becomes:

```typescript
  const name = normalize(form.get("name"));
  const email = normalize(form.get("email"));
```

And the insert call:

```typescript
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

becomes:

```typescript
  const { error: insertError } = await supabase.from("fitment_leads").insert({
    name: name || null,
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
Expected: PASS (7/7)

- [ ] **Step 5: Add the name field to the anonymous check form**

In `app/hub/FitmentChecker.tsx`, add name state near the existing email state:

```typescript
export default function FitmentChecker() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
```

Insert a "Full name" field immediately before the existing "Your email" label/input pair:

```tsx
      <label className="block font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12, marginBottom: 6 }}>
        Full name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Jane Doe"
        className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
        style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
      />

      <label className="block font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12, marginBottom: 6 }}>
        Your email
      </label>
```

In `checkFit`, where the submit `FormData` is built:

```typescript
    const form = new FormData();
    form.set("email", email.trim());
```

becomes:

```typescript
    const form = new FormData();
    form.set("name", name.trim());
    form.set("email", email.trim());
```

The name field is NOT added to `canSubmit`'s gating condition — it stays optional, matching the "nullable, not required" decision.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 7: Commit**

```bash
git add app/hub/FitmentChecker.tsx app/api/hub/fitment-check/route.ts app/api/hub/fitment-check/__tests__/route.test.ts
git commit -m "feat(hub): add optional full-name field to anonymous fitment check"
```

---

### Task 5: Update dashboard consumers — ScoreCard.tsx, app/hub/account/page.tsx

**Files:**
- Modify: `app/hub/account/ScoreCard.tsx`
- Modify: `app/hub/account/page.tsx`

**Interfaces:**
- Consumes: `FitmentReportResult` from `@/lib/generateFitmentReport` (Task 2, new nested shape).
- Produces: `ScoreCard`'s teaser logic now derives from `report.categories.flatMap(...)` instead of a top-level `report.requirements` array (which no longer exists in this shape). `app/hub/account/page.tsx`'s `fitment_reports` read selects the renamed/new columns.

Note: `app/hub/account/DashboardClient.tsx` and `app/hub/account/ReportPaywallModal.tsx` do NOT need changes — both already reference `FitmentReportResult` opaquely (imported type, never destructured internals), so they pick up the new shape automatically via the type import from Task 2.

- [ ] **Step 1: Update `app/hub/account/ScoreCard.tsx`**

Add, right after the existing `const delta = ...` line:

```typescript
  const allRequirements = report ? report.categories.flatMap((c) => c.requirements) : [];
  const topStrong = allRequirements.find((r) => r.matchLevel === "strong");
  const topMissing = allRequirements.find((r) => r.matchLevel === "missing");
```

Replace the two `report.requirements.find((r) => r.matchLevel === "strong")` / `"missing"` expressions inside the JSX (both the conditional-render check and the `.requirement` text lookup, four occurrences total — two per chip) with the `topStrong/topMissing` variables:

```tsx
            {topStrong && (
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
                  {topStrong.requirement}
                </span>
              </div>
            )}
            {topMissing && (
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
                  {topMissing.requirement}
                </span>
              </div>
            )}
```

- [ ] **Step 2: Update `app/hub/account/page.tsx`**

Replace this block:

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

with:

```typescript
  let report: FitmentReportResult | null = null;
  if (reportUnlocked) {
    const { data: reportRow } = await supabase
      .from("fitment_reports")
      .select("verdict_summary, categories, action_plan")
      .eq("user_id", user.id)
      .eq("role_title", current.role_title)
      .maybeSingle();
    if (reportRow) {
      report = {
        verdictSummary: reportRow.verdict_summary,
        categories: reportRow.categories,
        actionPlan: reportRow.action_plan,
      };
    }
  }
```

- [ ] **Step 3: Verify with tsc and a full build**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/ScoreCard.tsx app/hub/account/page.tsx
git commit -m "feat(hub): update dashboard consumers for category-grouped report shape"
```

---

### Task 6: app/hub/account/report/RequirementRow.tsx — must-have tag + interview note

**Files:**
- Modify: `app/hub/account/report/RequirementRow.tsx`

**Interfaces:**
- Produces: `export default function RequirementRow({ requirement, matchLevel, isMustHave, evidence, note, interviewNote }: { requirement: string; matchLevel: "strong" | "partial" | "missing"; isMustHave: boolean; evidence: string; note: string; interviewNote: string })`. Task 8's `CategorySection` renders one of these per requirement — signature drift breaks that wiring silently.

- [ ] **Step 1: Update the component's signature and header row**

Change the function signature from:

```typescript
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
```

to:

```typescript
export default function RequirementRow({
  requirement,
  matchLevel,
  isMustHave,
  evidence,
  note,
  interviewNote,
}: {
  requirement: string;
  matchLevel: "strong" | "partial" | "missing";
  isMustHave: boolean;
  evidence: string;
  note: string;
  interviewNote: string;
}) {
```

Change the header row from:

```tsx
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
```

to:

```tsx
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
        <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 10.5, marginLeft: "auto" }}>
          {isMustHave ? "Must-have" : "Nice-to-have"}
        </span>
      </div>
```

- [ ] **Step 2: Add the interview note block**

After the existing closing `note` paragraph:

```tsx
      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        {note}
      </p>
```

add:

```tsx
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #dcdcdc" }}>
        <p
          className="font-[family-name:var(--font-poppins)] font-semibold uppercase"
          style={{ fontSize: 10, letterSpacing: "0.06em", color: "#9c9c9c", margin: "0 0 4px" }}
        >
          How to talk about this
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
          {interviewNote}
        </p>
      </div>
```

- [ ] **Step 3: Verify it type-checks**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: errors referencing `CategorySection.tsx`/`report/page.tsx` are expected at this point (they haven't been updated yet, Tasks 8/9) — confirm there are no errors from within `RequirementRow.tsx` itself.

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/report/RequirementRow.tsx
git commit -m "feat(hub): add must-have tag and interview note to RequirementRow"
```

---

### Task 7: app/hub/account/report/ActionPlanItem.tsx — effort tag

**Files:**
- Modify: `app/hub/account/report/ActionPlanItem.tsx`

**Interfaces:**
- Produces: `export default function ActionPlanItem({ priority, action, why, effort }: { priority: number; action: string; why: string; effort: "quick" | "moderate" | "long-term" })`. Task 9's report page renders one of these per action plan item.

- [ ] **Step 1: Update the component**

Replace the entire file with:

```tsx
export default function ActionPlanItem({
  priority,
  action,
  why,
  effort,
}: {
  priority: number;
  action: string;
  why: string;
  effort: "quick" | "moderate" | "long-term";
}) {
  const isTop = priority === 1;
  const effortLabel = { quick: "Quick fix", moderate: "Takes practice", "long-term": "Long-term" }[effort];

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
        <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
          <p
            className="font-[family-name:var(--font-poppins)] font-semibold text-black"
            style={{ fontSize: isTop ? 15 : 13.5, margin: 0 }}
          >
            {action}
          </p>
          <span
            className="font-[family-name:var(--font-poppins)] font-semibold"
            style={{ fontSize: 10, color: "#9c9c9c", border: "1px solid #dcdcdc", borderRadius: 50, padding: "2px 8px" }}
          >
            {effortLabel}
          </span>
        </div>
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
Expected: no errors originating from `ActionPlanItem.tsx` itself (errors from `report/page.tsx` calling it with the old signature are expected until Task 9).

- [ ] **Step 3: Commit**

```bash
git add app/hub/account/report/ActionPlanItem.tsx
git commit -m "feat(hub): add effort tag to ActionPlanItem"
```

---

### Task 8: app/hub/account/report/CategorySection.tsx — new component

**Files:**
- Create: `app/hub/account/report/CategorySection.tsx`

**Interfaces:**
- Consumes: `RequirementRow` (Task 6), `FitmentReportResult` type from `@/lib/generateFitmentReport` (Task 2).
- Produces: `export default function CategorySection({ category, matchedCount, totalCount, requirements }: FitmentReportResult["categories"][number])`. Task 9 renders one of these per entry in `FitmentReportResult["categories"]`.

- [ ] **Step 1: Write the component**

```tsx
import RequirementRow from "./RequirementRow";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";

export default function CategorySection({
  category,
  matchedCount,
  totalCount,
  requirements,
}: FitmentReportResult["categories"][number]) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.1rem", margin: 0 }}>
          {category}
        </h3>
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13 }}>
          {matchedCount} of {totalCount} matched
        </span>
      </div>
      <div className="bg-[#f0e6ea] overflow-hidden" style={{ height: 6, borderRadius: 6, marginBottom: 14 }}>
        <div
          className="bg-[#ed1a24] h-full"
          style={{ borderRadius: 6, width: `${totalCount > 0 ? (matchedCount / totalCount) * 100 : 0}%` }}
        />
      </div>
      {requirements.map((r, i) => (
        <RequirementRow
          key={i}
          requirement={r.requirement}
          matchLevel={r.matchLevel}
          isMustHave={r.isMustHave}
          evidence={r.evidence}
          note={r.note}
          interviewNote={r.interviewNote}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors originating from `CategorySection.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add app/hub/account/report/CategorySection.tsx
git commit -m "feat(hub): add CategorySection component for full report page"
```

---

### Task 9: app/hub/account/report/page.tsx — rewrite with header, verdict, categories

**Files:**
- Modify (full rewrite): `app/hub/account/report/page.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient` from `@/lib/supabaseAuthServer`, `isReportUnlocked` from `@/lib/reportUnlocks`, `FitmentReportResult` from `@/lib/generateFitmentReport`, `CategorySection` (Task 8), `ActionPlanItem` (Task 7).
- Produces: the `/hub/account/report` route, rewritten.

- [ ] **Step 1: Rewrite the page**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
import CategorySection from "./CategorySection";
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
    .select("role_title, score, name")
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
    .select("verdict_summary, categories, action_plan")
    .eq("user_id", user.id)
    .eq("role_title", current.role_title)
    .maybeSingle();

  if (!reportRow) {
    redirect("/hub/account");
  }

  const displayName = current.name || user.email || "Candidate";
  const formattedDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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

        <div className="flex items-center justify-between flex-wrap" style={{ margin: "14px 0 4px", gap: 12 }}>
          <div>
            <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.8rem", margin: 0 }}>
              {displayName}
            </h1>
            <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, margin: "4px 0 0" }}>
              {current.score.toFixed(1)} / 10 fit for {current.role_title} · {formattedDate}
            </p>
          </div>
          <Image src="/logo.png" alt="Merito" width={100} height={28} style={{ height: 24, width: "auto" }} />
        </div>

        <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, margin: "20px 0 32px" }}>
          <p
            className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
            style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}
          >
            Assessment summary
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>
            {reportRow.verdict_summary}
          </p>
        </div>

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "0 0 14px" }}>
          Match breakdown
        </h2>
        {reportRow.categories.map((c: FitmentReportResult["categories"][number], i: number) => (
          <CategorySection
            key={i}
            category={c.category}
            matchedCount={c.matchedCount}
            totalCount={c.totalCount}
            requirements={c.requirements}
          />
        ))}

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "32px 0 14px" }}>
          Your action plan
        </h2>
        {sortedActionPlan.map((item: FitmentReportResult["actionPlan"][number], i: number) => (
          <ActionPlanItem key={i} priority={item.priority} action={item.action} why={item.why} effort={item.effort} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify with tsc and a full build**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no errors — this is the point where all the Task 6-8 signature changes and this rewrite must agree with each other and with `FitmentReportResult`.

Run: `npm run build`
Expected: succeeds, `/hub/account/report` listed as a dynamic route.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/report/page.tsx
git commit -m "feat(hub): rewrite full report page with header, verdict summary, category sections"
```

---

### Task 10: Manual end-to-end verification

**Files:** none (verification only)

**Interfaces:** none.

This mirrors Phase 2b's own Task 8 — a real run against the same live Supabase project. Requires a human to apply Task 1's migration first.

- [ ] **Step 1: Apply the migration**

A human runs `supabase/migrations/0005_fitment_reports_categories.sql` against the live project.

- [ ] **Step 2: Run the full automated suite one more time on the final branch state**

Run: `npm test` — expect PASS, all files.
Run: `./node_modules/.bin/tsc --noEmit -p .` — expect no errors.
Run: `npm run build` — expect success.

- [ ] **Step 3: Manually verify the redesigned report**

With the dev server running:
1. Submit a fresh anonymous fitment check on `/hub` with the new "Full name" field filled in — confirm submission succeeds and the score renders as before.
2. Sign in, do a free CV re-check on `/hub/account` for the current role to regenerate the report under this new schema — old reports from Phase 2b's flat-list schema won't have `verdict_summary`/`categories` populated correctly.
3. Unlock the report — confirm `ScoreCard`'s teaser still shows a Strong/Missing chip pair (now derived via the categories flatMap).
4. Click through to `/hub/account/report` — confirm: the header shows the submitted name (or falls back to email if left blank on a different test run), role, today's date, and the Merito logo; an "Assessment summary" box renders a coherent paragraph (not a template fragment); every category section shows a "N of M matched" fraction and mini-bar; every requirement row shows its must-have/nice-to-have tag, its evidence quote (or "Not found in your CV"), and a distinct "How to talk about this" interview note; the action plan shows effort tags and remains priority-ordered.
5. Confirm the page still reads as structured and scannable even with a JD that produces many requirements — the category grouping should prevent the "wall of 21 identical cards" problem from recurring.

- [ ] **Step 4: Record the outcome**

No code changes in this task — record the outcome in `.superpowers/sdd/progress.md`, same as Phase 2b's own Task 8.
