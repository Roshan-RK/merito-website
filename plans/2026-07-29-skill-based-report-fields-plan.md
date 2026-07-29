# Map the Rest of the Skill-Based Interview Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map, persist, and surface `skillReport`, `interviewTitle`, `overallSkillScore`, and the full `answers[]` transcript from IntervueBox's real API response — all currently silently dropped by `getInterviewReport`. Map+persist only (no UI) for `knowledgeAnswers`. `rank` is explicitly out of scope.

**Architecture:** Same shape as every interview-report field added this session: extend the raw/mapped types in `lib/intervuebox/interviewReports.ts`, extend the webhook's `report_raw` persistence, add display components gated on presence, wire into `interview/page.tsx` and (for `skillReport`/`overallSkillScore` only) `combined-report/page.tsx`.

**Tech Stack:** Next.js, TypeScript, Vitest.

## Global Constraints

- `rank` is not mapped anywhere — dropped per explicit product decision (candidates are isolated per-job, cross-candidate ranking isn't meaningful).
- `knowledgeAnswers` gets typed/mapped/persisted but no UI — shape is unconfirmed (always `[]` in every real sample seen), building UI for an unknown shape isn't buildable in good conscience.
- Per-answer sub-dimension scores (`correctness`/`relevance`/`communication`/`problemSolving`/`confidence`) are NOT carried into `AnswerDetail.metrics` — redundant with the aggregate `skillMetrics` already shown elsewhere; only `score`, `evaluation`, and `dynamicSkills` per answer.
- Transcript UI is `interview/page.tsx` only, not `combined-report/page.tsx` (print/PDF context).
- Confirmed repo convention (checked this session): zero test files exist for any `"use client"` component under `app/hub/account/` — new display components get manual/visual verification, not unit tests. Only the type/mapping layer and the webhook route get TDD.

---

### Task 1: Extend types and mapping in `getInterviewReport`

**Files:**
- Modify: `lib/intervuebox/interviewReports.ts`
- Test: `lib/intervuebox/__tests__/interviewReports.test.ts`

**Interfaces:**
- Produces: `SkillReportEntry = { score: number; comment: string }`, `AnswerDetail = { question: string; transcript: string; timestamp: string; metrics: { score?: number; evaluation?: string; dynamicSkills: Array<{ skill: string; comment: string }> } }`. `InterviewReportReady` gains `interviewTitle: string | null`, `skillReport: Record<string, SkillReportEntry>`, `overallSkillScore: number | null`, `answers: AnswerDetail[]`, `knowledgeAnswers: unknown[]`.

- [ ] **Step 1: Write the failing test**

Add to `lib/intervuebox/__tests__/interviewReports.test.ts`, a new test alongside the existing "issues a real GET request..." test:

```ts
  it("maps skillReport, interviewTitle, overallSkillScore, answers, and knowledgeAnswers", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          shareableReportLink: null,
          sessionDetails: {
            skillReport: {
              sales: { score: 56, comment: "Solid pitch structure." },
              communication: { score: 3, comment: "Struggled to articulate points." },
            },
            interviewTitle: "Sales Interview",
            overallSkillScore: 57,
            knowledgeAnswers: [],
            answers: [
              {
                question: "Tell me about a time you closed a deal.",
                transcript: "I once closed a six-figure deal by...",
                timestamp: "00:01:24",
                metrics: {
                  score: 79,
                  evaluation: "Strong, specific example with measurable outcome.",
                  dynamicSkills: [{ skill: "sales", comment: "" }],
                },
              },
            ],
            overallReport: {
              score: 39,
              metrics: { communication: 39, relevance: 41 },
              overallSummary: "Mixed performance.",
            },
          },
        })
      );
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toMatchObject({
      status: "READY",
      interviewTitle: "Sales Interview",
      overallSkillScore: 57,
      skillReport: {
        sales: { score: 56, comment: "Solid pitch structure." },
        communication: { score: 3, comment: "Struggled to articulate points." },
      },
      knowledgeAnswers: [],
      answers: [
        {
          question: "Tell me about a time you closed a deal.",
          transcript: "I once closed a six-figure deal by...",
          timestamp: "00:01:24",
          metrics: {
            score: 79,
            evaluation: "Strong, specific example with measurable outcome.",
            dynamicSkills: [{ skill: "sales", comment: "" }],
          },
        },
      ],
    });
  });

  it("defaults skillReport/interviewTitle/overallSkillScore/answers/knowledgeAnswers when the upstream report omits them", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          shareableReportLink: null,
          sessionDetails: {
            skillReport: {},
            overallReport: { score: 5, metrics: {}, overallSummary: "No extras." },
          },
        })
      );
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toMatchObject({
      status: "READY",
      interviewTitle: null,
      overallSkillScore: null,
      skillReport: {},
      answers: [],
      knowledgeAnswers: [],
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/intervuebox/__tests__/interviewReports.test.ts`
Expected: FAIL — the new fields are `undefined` in the result, not matching the expected values.

- [ ] **Step 3: Add the types**

In `lib/intervuebox/interviewReports.ts`, after the `CriteriaEvaluationEntry` type (before `InterviewReportReady`):

```ts
export type SkillReportEntry = { score: number; comment: string };

export type AnswerDetail = {
  question: string;
  transcript: string;
  timestamp: string;
  metrics: {
    score?: number;
    evaluation?: string;
    dynamicSkills: Array<{ skill: string; comment: string }>;
  };
};
```

Add to `InterviewReportReady` (after `criteriaEvaluationTable: CriteriaEvaluationEntry[];`):

```ts
  interviewTitle: string | null;
  skillReport: Record<string, SkillReportEntry>;
  overallSkillScore: number | null;
  answers: AnswerDetail[];
  knowledgeAnswers: unknown[];
```

- [ ] **Step 4: Update `RawInterviewReportResponse`**

Replace the existing `sessionDetails.answers?: Array<{ timestamp: string }>;` line with the richer shape (same field, one definition — the duration calc in Step 5 still works against `.timestamp`):

```ts
    answers?: Array<{
      question: string;
      transcript: string;
      timestamp: string;
      metrics?: {
        score?: number;
        evaluation?: string;
        dynamicSkills?: Array<{ skill: string; comment: string }>;
      };
    }>;
```

Add alongside it in `sessionDetails`:

```ts
    interviewTitle?: string;
    skillReport?: Record<string, { score: number; comment: string }>;
    overallSkillScore?: number;
    knowledgeAnswers?: unknown[];
```

- [ ] **Step 5: Update the mapping in `getInterviewReport`**

Add to the returned object (after `criteriaEvaluationTable: overallReport.criteriaEvaluationTable ?? [],`):

```ts
      interviewTitle: response.sessionDetails.interviewTitle ?? null,
      skillReport: response.sessionDetails.skillReport ?? {},
      overallSkillScore: response.sessionDetails.overallSkillScore ?? null,
      knowledgeAnswers: response.sessionDetails.knowledgeAnswers ?? [],
      answers: (response.sessionDetails.answers ?? []).map((a) => ({
        question: a.question,
        transcript: a.transcript,
        timestamp: a.timestamp,
        metrics: {
          score: a.metrics?.score,
          evaluation: a.metrics?.evaluation,
          dynamicSkills: a.metrics?.dynamicSkills ?? [],
        },
      })),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- lib/intervuebox/__tests__/interviewReports.test.ts`
Expected: PASS, all tests including the pre-existing "issues a real GET request..." exact-shape test (`toEqual`) — that test's mocked response has no `answers`/`skillReport`/etc., so its expected object needs the 5 new fields added with their default values (`interviewTitle: null, skillReport: {}, overallSkillScore: null, answers: [], knowledgeAnswers: []`) for the exact-equality check to still pass. Add them there too.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add lib/intervuebox/interviewReports.ts lib/intervuebox/__tests__/interviewReports.test.ts
git commit -m "feat(hub): map skillReport, interviewTitle, overallSkillScore, answers transcript"
```

---

### Task 2: Persist the new fields through the webhook

**Files:**
- Modify: `app/api/webhooks/intervuebox/route.ts`
- Test: `app/api/webhooks/intervuebox/__tests__/route.test.ts`

**Interfaces:**
- Consumes: the 5 new `InterviewReportReady` fields from Task 1.

- [ ] **Step 1: Write the failing test**

In `app/api/webhooks/intervuebox/__tests__/route.test.ts`, extend the mocked report in the `"sweeps invited rows..."` test to include the new fields, and extend the `report_raw` assertion:

```ts
        return {
          status: "READY",
          overallScore: 8,
          skillMetrics: { technical: 8 },
          overallSummary: "Strong candidate.",
          strengths: "Clear communication.",
          areasOfImprovement: "More examples.",
          shareableReportLink: "https://app.intervuebox.com/reports/ISE_1",
          approxDurationMinutes: 4,
          criteriaEvaluationTable: [],
          interviewTitle: "Technical Interview",
          skillReport: { javascript: { score: 82, comment: "Strong fundamentals." } },
          overallSkillScore: 75,
          answers: [],
          knowledgeAnswers: [],
        };
```

and extend the `report_raw` `expect.objectContaining`:

```ts
        report_raw: expect.objectContaining({
          approxDurationMinutes: 4,
          interviewTitle: "Technical Interview",
          skillReport: { javascript: { score: 82, comment: "Strong fundamentals." } },
          overallSkillScore: 75,
        }),
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/webhooks/intervuebox/__tests__/route.test.ts`
Expected: FAIL — `report_raw` doesn't contain the new fields yet.

- [ ] **Step 3: Persist the fields**

In `app/api/webhooks/intervuebox/route.ts`, add to the `report_raw` object (after `criteriaEvaluationTable: report.criteriaEvaluationTable,`):

```ts
                interviewTitle: report.interviewTitle,
                skillReport: report.skillReport,
                overallSkillScore: report.overallSkillScore,
                answers: report.answers,
                knowledgeAnswers: report.knowledgeAnswers,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/webhooks/intervuebox/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/intervuebox/route.ts app/api/webhooks/intervuebox/__tests__/route.test.ts
git commit -m "feat(hub): persist skillReport/interviewTitle/overallSkillScore/answers/knowledgeAnswers"
```

---

### Task 3: `SkillReportTable` — skill-wise table for skill-based interviews

**Files:**
- Create: `app/hub/account/interview/SkillReportTable.tsx`
- Modify: `app/hub/account/interview/page.tsx`
- Modify: `app/hub/account/combined-report/page.tsx`

**Interfaces:**
- Consumes: `report.skillReport: Record<string, SkillReportEntry>` (Task 1).

- [ ] **Step 1: Write `SkillReportTable.tsx`**

```tsx
"use client";

function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function scoreColor(score: number): string {
  if (score >= 70) return "#16803c";
  if (score >= 40) return "#d97706";
  return "#ed1a24";
}

export default function SkillReportTable({ skillReport }: { skillReport: Record<string, { score: number; comment: string }> }) {
  const entries = Object.entries(skillReport);
  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 14px" }}>
        Skill-wise evaluation
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {entries.map(([skill, entry], i) => (
          <div key={skill} style={{ borderTop: i > 0 ? "1px solid rgba(0,0,0,0.08)" : undefined, paddingTop: i > 0 ? 14 : 0 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.02rem", margin: 0 }}>
                {titleCase(skill)}
              </h3>
              <span
                className="font-[family-name:var(--font-poppins)] font-semibold"
                style={{ fontSize: 12, color: scoreColor(entry.score) }}
              >
                {Math.round(entry.score)}%
              </span>
            </div>
            <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              {entry.comment}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `interview/page.tsx`**

Add import `import SkillReportTable from "./SkillReportTable";`. Place right before the existing `{typeof report.skillMetrics?.criteriaMatch === "number" && (...)}` block:

```tsx
{Object.keys(report.skillReport).length > 0 && (
  <SkillReportTable skillReport={report.skillReport} />
)}
```

- [ ] **Step 3: Wire into `combined-report/page.tsx`**

Add import `import SkillReportTable from "../interview/SkillReportTable";`. Same gated placement, right before that page's `criteriaMatch` block:

```tsx
{Object.keys(interview.report.skillReport).length > 0 && (
  <SkillReportTable skillReport={interview.report.skillReport} />
)}
```

- [ ] **Step 4: Run full suite + typecheck**

Run: `npm test && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/interview/SkillReportTable.tsx app/hub/account/interview/page.tsx app/hub/account/combined-report/page.tsx
git commit -m "feat(hub): add skill-wise evaluation table for skill-based interviews"
```

---

### Task 4: `interviewTitle` and `overallSkillScore` display

**Files:**
- Modify: `app/hub/account/interview/page.tsx`
- Modify: `app/hub/account/combined-report/page.tsx`

**Interfaces:**
- Consumes: `report.interviewTitle: string | null`, `report.overallSkillScore: number | null` (Task 1).

- [ ] **Step 1: `interview/page.tsx` — `interviewTitle`**

In the header area, right after the existing role-title pill (`<span className="bg-[#ed1a24] ...">{interview.role_title}</span>`), add:

```tsx
{report.interviewTitle && (
  <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, margin: "4px 0 0" }}>
    {report.interviewTitle}
  </p>
)}
```

- [ ] **Step 2: `interview/page.tsx` — `overallSkillScore`**

Right after the "AI overview" card's closing `</div>`, before the strengths/areas grid:

```tsx
{report.overallSkillScore != null && (
  <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, margin: "0 0 20px" }}>
    Overall skill score: <strong className="text-black">{Math.round(report.overallSkillScore)}%</strong>
  </p>
)}
```

- [ ] **Step 3: Same `overallSkillScore` line in `combined-report/page.tsx`**

Same pattern, right after that page's "AI overview" card.

- [ ] **Step 4: Run full suite + typecheck**

Run: `npm test && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/interview/page.tsx app/hub/account/combined-report/page.tsx
git commit -m "feat(hub): show interviewTitle and overallSkillScore on interview reports"
```

---

### Task 5: `AnswerTranscript` — expandable Q&A transcript

**Files:**
- Create: `app/hub/account/interview/AnswerTranscript.tsx`
- Modify: `app/hub/account/interview/page.tsx`

**Interfaces:**
- Consumes: `report.answers: AnswerDetail[]` (Task 1).

- [ ] **Step 1: Write `AnswerTranscript.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { AnswerDetail } from "@/lib/intervuebox/interviewReports";

export default function AnswerTranscript({ answers }: { answers: AnswerDetail[] }) {
  const [expanded, setExpanded] = useState(false);

  if (answers.length === 0) return null;

  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}
      >
        {expanded ? "Hide" : "View"} full transcript ({answers.length} question{answers.length === 1 ? "" : "s"})
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 16 }}>
          {answers.map((answer, i) => (
            <div key={i} style={{ borderTop: i > 0 ? "1px solid rgba(0,0,0,0.08)" : undefined, paddingTop: i > 0 ? 18 : 0 }}>
              <p className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 13.5, margin: "0 0 8px" }}>
                {answer.question}
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 8px", whiteSpace: "pre-wrap" }}>
                {answer.transcript || "No answer given."}
              </p>
              <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                {answer.metrics.score != null && (
                  <span className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 11, background: "#ed1a24", borderRadius: 50, padding: "2px 10px" }}>
                    {answer.metrics.score}%
                  </span>
                )}
                {answer.metrics.dynamicSkills.map((tag, j) => (
                  <span key={j} className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11, border: "1px solid #dcdcdc", borderRadius: 50, padding: "2px 10px" }}>
                    {tag.skill}
                  </span>
                ))}
              </div>
              {answer.metrics.evaluation && (
                <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12, lineHeight: 1.6, margin: "8px 0 0" }}>
                  {answer.metrics.evaluation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `interview/page.tsx`**

Add import `import AnswerTranscript from "./AnswerTranscript";`. Place right before the final `{report.shareableReportLink && (...)}` block:

```tsx
<AnswerTranscript answers={report.answers} />
```

(No gating needed at the call site — the component itself returns `null` when `answers` is empty.)

- [ ] **Step 3: Run full suite + typecheck**

Run: `npm test && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/interview/AnswerTranscript.tsx app/hub/account/interview/page.tsx
git commit -m "feat(hub): add expandable full Q&A transcript to the interview report page"
```

---

## Verification

- `npm test && npx tsc --noEmit` clean after every task.
- Manual/visual verification once a real skill-based interview completes post-flag-flip (none has as of this plan's writing) — screenshot `/hub/account/interview` and confirm: interview title shown, overall skill score line shown, skill-wise table renders with real skill names/scores/comments, transcript toggle expands to show real Q&A with per-answer score/skill-tag/evaluation. Until then, the old real skill-based sample (`Response.json`, Sales interview, captured 2026-07-27) can be manually seeded (same throwaway-script approach used earlier this session) to verify rendering against real-shaped data.
- Confirm `criteriaEvaluationTable`/`skillReport` blocks are mutually exclusive in practice (one populated, one empty, depending on which mode ran) — not enforced in code, just a consequence of which fields IntervueBox populates per mode.
