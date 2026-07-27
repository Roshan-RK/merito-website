# AI Interview Report UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/hub/account/interview` to match the layout of IntervueBox's own PDF report (parameters-score grid, circular overall-score gauge, two-column strengths/improvements) using Merito's existing color/font tokens, scoped strictly to data the API actually returns.

**Architecture:** Two small logic additions (an `approxDurationMinutes` field computed once at webhook-ingestion time, threaded through `report_raw`) plus two new presentational components (`InterviewScoreGauge`, `ParameterScoreTile`) that replace the old `InterviewSkillCard` bar-list on this page only. The fitment report page and its bar-style components are unaffected.

**Tech Stack:** Next.js App Router (RSC), TypeScript, Tailwind utility classes + inline styles (existing repo convention), Vitest, Supabase, IntervueBox REST API.

## Global Constraints

- Fonts: `var(--font-gabarito)` for headings, `var(--font-poppins)` for body — no other fonts.
- Colors: `#ed1a24` (Merito red, primary), `#16803c`/`#eefdf1` (green success, matches `ProgressRail`'s "done" state and the dashboard's "Top strengths" card), `#fdeced` (red tint, matches the dashboard's "Gaps costing you shortlists" card), `#4b4b4d` (muted text), `#9c9c9c` (label gray), `#fdf8fb` (page background), `border-black/[0.08]` (card borders) — no new palette values. Reference: `design_handoff_merito_hub/dashboard/Merito HUB Dashboard.dc.html` confirms these tokens and the circular-gauge pattern already exist in the approved Hub design system (used there for "Profile progress").
- Presentational React components in this codebase (`InterviewSkillCard`, `ResumeMatchCategoryCard`, `CandidateProfile`, page-level RSC components) have no dedicated test files in the existing convention — only `lib/*` functions and API routes are unit-tested. Follow this: don't introduce component-rendering tests where the repo has none, but DO unit-test any new pure/exported logic function (matches this session's earlier precedent: `inferInterviewType`, `inferExperienceFromJD`).
- Spec: `specs/2026-07-23-interview-report-ui-redesign-design.md` — read first for the full rationale (this plan implements it verbatim, no scope beyond it).

---

### Task 1: Compute and store `approxDurationMinutes` in `lib/intervuebox/interviewReports.ts`

**Files:**
- Modify: `lib/intervuebox/interviewReports.ts`
- Test: `lib/intervuebox/__tests__/interviewReports.test.ts`

**Interfaces:**
- Consumes: nothing new (uses the existing `getWithBody` helper already in this file)
- Produces: `InterviewReportReady.approxDurationMinutes: number | null` — Task 2 and Task 4 both read this field

- [ ] **Step 1: Write the failing test**

Edit `lib/intervuebox/__tests__/interviewReports.test.ts`. Replace the existing first `it` block's mock response and expected result (adding `answers` to the mock, `approxDurationMinutes: 4` to the expectation), and add one new test for the no-answers case. Replace the entire first test with:

```ts
describe("getInterviewReport", () => {
  it("issues a real GET request carrying a JSON body and maps a ready report", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          shareableReportLink: "https://app.intervuebox.com/reports/ISE_123",
          sessionDetails: {
            skillReport: {},
            answers: [{ timestamp: "00:00:24" }, { timestamp: "00:03:27" }],
            overallReport: {
              score: 8,
              metrics: { technical: 8, communication: 9, problemSolving: 8 },
              overallSummary: "Strong candidate.",
              strengths: "Clear technical explanations.",
              areasOfImprovement: "Could give more concrete examples.",
              feedbackToInterviewer: "Recommend advancing.",
              rank: 1,
            },
          },
        })
      );
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    // Proves the exact bug class from the critical finding cannot recur:
    // a real GET request that actually carries a non-empty body.
    expect(lastRequest?.method).toBe("GET");
    expect(lastRequest?.body).toBeTruthy();
    expect(JSON.parse(lastRequest!.body)).toEqual({ interviewId: "INT_123", candidateId: "USR_123" });

    expect(result).toEqual({
      status: "READY",
      overallScore: 8,
      skillMetrics: { technical: 8, communication: 9, problemSolving: 8 },
      overallSummary: "Strong candidate.",
      strengths: "Clear technical explanations.",
      areasOfImprovement: "Could give more concrete examples.",
      shareableReportLink: "https://app.intervuebox.com/reports/ISE_123",
      approxDurationMinutes: 4,
    });
  });

  it("returns null approxDurationMinutes when the session has no answers", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          shareableReportLink: null,
          sessionDetails: {
            skillReport: {},
            overallReport: {
              score: 5,
              metrics: {},
              overallSummary: "Ended early.",
            },
          },
        })
      );
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toMatchObject({ status: "READY", approxDurationMinutes: null });
  });
```

Leave the two other existing `it` blocks (`"returns NOT_READY..."`, `"re-throws non-404 errors"`) and the closing `});` untouched.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/intervuebox/__tests__/interviewReports.test.ts`
Expected: FAIL — `result` is missing `approxDurationMinutes` (actual object won't have the key, so `toEqual` fails).

- [ ] **Step 3: Implement `approxDurationMinutes` derivation**

Edit `lib/intervuebox/interviewReports.ts`. Add the field to the public type, extend the raw response type, add two small helper functions, and use them in `getInterviewReport`.

Change:
```ts
export type InterviewReportReady = {
  overallScore: number; // 0-10, per sessionDetails.overallReport.score
  skillMetrics: Record<string, number>; // 0-10 each, per sessionDetails.overallReport.metrics
  overallSummary: string;
  strengths: string | null;
  areasOfImprovement: string | null;
  shareableReportLink: string | null;
};
```
to:
```ts
export type InterviewReportReady = {
  overallScore: number; // 0-10, per sessionDetails.overallReport.score
  skillMetrics: Record<string, number>; // 0-10 each, per sessionDetails.overallReport.metrics
  overallSummary: string;
  strengths: string | null;
  areasOfImprovement: string | null;
  shareableReportLink: string | null;
  approxDurationMinutes: number | null;
};
```

Change:
```ts
type RawInterviewReportResponse = {
  shareableReportLink: string | null;
  sessionDetails: {
    overallReport: {
      score: number;
      metrics: Record<string, number>;
      overallSummary: string;
      strengths?: string;
      areasOfImprovement?: string;
    };
  };
};
```
to:
```ts
type RawInterviewReportResponse = {
  shareableReportLink: string | null;
  sessionDetails: {
    // Only used for an approximate interview duration — the last answer's
    // timestamp is a proxy for total elapsed time, not a true recording-length
    // field (IntervueBox doesn't expose one). Never presented as exact.
    answers?: Array<{ timestamp: string }>;
    overallReport: {
      score: number;
      metrics: Record<string, number>;
      overallSummary: string;
      strengths?: string;
      areasOfImprovement?: string;
    };
  };
};

function parseTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function computeApproxDurationMinutes(answers: Array<{ timestamp: string }> | undefined): number | null {
  if (!answers || answers.length === 0) return null;
  const lastTimestamp = answers[answers.length - 1].timestamp;
  return Math.ceil(parseTimestampToSeconds(lastTimestamp) / 60);
}
```

Change the return in `getInterviewReport`:
```ts
    const overallReport = response.sessionDetails.overallReport;
    return {
      status: "READY",
      overallScore: overallReport.score,
      skillMetrics: overallReport.metrics,
      overallSummary: overallReport.overallSummary,
      strengths: overallReport.strengths ?? null,
      areasOfImprovement: overallReport.areasOfImprovement ?? null,
      shareableReportLink: response.shareableReportLink,
    };
```
to:
```ts
    const overallReport = response.sessionDetails.overallReport;
    return {
      status: "READY",
      overallScore: overallReport.score,
      skillMetrics: overallReport.metrics,
      overallSummary: overallReport.overallSummary,
      strengths: overallReport.strengths ?? null,
      areasOfImprovement: overallReport.areasOfImprovement ?? null,
      shareableReportLink: response.shareableReportLink,
      approxDurationMinutes: computeApproxDurationMinutes(response.sessionDetails.answers),
    };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/intervuebox/__tests__/interviewReports.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git commit --only lib/intervuebox/interviewReports.ts lib/intervuebox/__tests__/interviewReports.test.ts -m "feat(hub): derive approximate AI-interview duration from last answer timestamp"
```

---

### Task 2: Persist `approxDurationMinutes` in the webhook's `report_raw` write

**Files:**
- Modify: `app/api/webhooks/intervuebox/route.ts`
- Test: `app/api/webhooks/intervuebox/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `InterviewReportReady.approxDurationMinutes` (Task 1)
- Produces: `fitment_interviews.report_raw.approxDurationMinutes` — Task 4's `page.tsx` reads this

- [ ] **Step 1: Write the failing test**

Edit `app/api/webhooks/intervuebox/__tests__/route.test.ts`. In the `"sweeps invited rows..."` test, change the mocked return value:

```ts
    getInterviewReportMock.mockImplementation(async (interviewId: string) => {
      if (interviewId === "INT_1") {
        return {
          status: "READY",
          overallScore: 8,
          skillMetrics: { technical: 8 },
          overallSummary: "Strong candidate.",
          strengths: "Clear communication.",
          areasOfImprovement: "More examples.",
          shareableReportLink: "https://app.intervuebox.com/reports/ISE_1",
          approxDurationMinutes: 4,
        };
      }
      return { status: "NOT_READY" };
    });
```

And replace the existing (looser) assertion:
```ts
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready" })
    );
```
with:
```ts
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ready",
        report_raw: expect.objectContaining({ approxDurationMinutes: 4 }),
      })
    );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/webhooks/intervuebox/__tests__/route.test.ts`
Expected: FAIL — `report_raw` doesn't have `approxDurationMinutes` yet.

- [ ] **Step 3: Implement**

Edit `app/api/webhooks/intervuebox/route.ts`. Change:
```ts
              report_raw: {
                overallScore: report.overallScore,
                skillMetrics: report.skillMetrics,
                overallSummary: report.overallSummary,
                strengths: report.strengths,
                areasOfImprovement: report.areasOfImprovement,
                shareableReportLink: report.shareableReportLink,
              },
```
to:
```ts
              report_raw: {
                overallScore: report.overallScore,
                skillMetrics: report.skillMetrics,
                overallSummary: report.overallSummary,
                strengths: report.strengths,
                areasOfImprovement: report.areasOfImprovement,
                shareableReportLink: report.shareableReportLink,
                approxDurationMinutes: report.approxDurationMinutes,
              },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/webhooks/intervuebox/__tests__/route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git commit --only app/api/webhooks/intervuebox/route.ts app/api/webhooks/intervuebox/__tests__/route.test.ts -m "feat(hub): store approxDurationMinutes on the AI-interview report row"
```

---

### Task 3: `InterviewScoreGauge` component

**Files:**
- Create: `app/hub/account/interview/InterviewScoreGauge.tsx`
- Test: `app/hub/account/interview/__tests__/InterviewScoreGauge.test.ts`

**Interfaces:**
- Consumes: nothing (pure)
- Produces: `getScoreBand(score: number): { label: string; textColor: string; trackColor: string }` (named export) and `InterviewScoreGauge` (default export, component, props `{ score: number }`) — Task 4's `page.tsx` renders `<InterviewScoreGauge score={report.overallScore} />`

- [ ] **Step 1: Write the failing test**

Create `app/hub/account/interview/__tests__/InterviewScoreGauge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getScoreBand } from "../InterviewScoreGauge";

describe("getScoreBand", () => {
  it("bands the bottom of the 0-10 range as Needs work (red)", () => {
    expect(getScoreBand(0)).toEqual({ label: "Needs work", textColor: "#ed1a24", trackColor: "#fdeced" });
  });

  it("bands just under the Developing threshold as Needs work", () => {
    expect(getScoreBand(3.9).label).toBe("Needs work");
  });

  it("bands the Developing threshold as Developing (gray)", () => {
    expect(getScoreBand(4)).toEqual({ label: "Developing", textColor: "#4b4b4d", trackColor: "#f0e6ea" });
  });

  it("bands just under the Strong threshold as Developing", () => {
    expect(getScoreBand(6.9).label).toBe("Developing");
  });

  it("bands the Strong threshold as Strong (green)", () => {
    expect(getScoreBand(7)).toEqual({ label: "Strong", textColor: "#16803c", trackColor: "#eefdf1" });
  });

  it("bands the top of the range as Strong", () => {
    expect(getScoreBand(10).label).toBe("Strong");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/hub/account/interview/__tests__/InterviewScoreGauge.test.ts`
Expected: FAIL — cannot find module `../InterviewScoreGauge` (file doesn't exist yet).

- [ ] **Step 3: Implement**

Create `app/hub/account/interview/InterviewScoreGauge.tsx`:

```tsx
export type ScoreBand = { label: string; textColor: string; trackColor: string };

// Bands are Merito's own — IntervueBox's own POOR/GOOD/etc. thresholds are
// undocumented and inaccessible to us (see specs/2026-07-23-interview-report-ui-redesign-design.md).
// Colors reuse tokens already established elsewhere in the Hub (ProgressRail's
// "done" green, the existing muted-gray, Merito's primary red) rather than
// introducing a new palette.
export function getScoreBand(score: number): ScoreBand {
  const clamped = Math.min(10, Math.max(0, score));
  if (clamped >= 7) return { label: "Strong", textColor: "#16803c", trackColor: "#eefdf1" };
  if (clamped >= 4) return { label: "Developing", textColor: "#4b4b4d", trackColor: "#f0e6ea" };
  return { label: "Needs work", textColor: "#ed1a24", trackColor: "#fdeced" };
}

export default function InterviewScoreGauge({ score }: { score: number }) {
  const clamped = Math.min(10, Math.max(0, score));
  const band = getScoreBand(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / 10) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={70} cy={70} r={radius} fill="none" stroke="#f0e6ea" strokeWidth={12} />
        <circle
          cx={70}
          cy={70}
          r={radius}
          fill="none"
          stroke={band.textColor}
          strokeWidth={12}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
        <text
          x={70}
          y={68}
          textAnchor="middle"
          fontSize={28}
          fontWeight={700}
          fill="#000"
          className="font-[family-name:var(--font-gabarito)]"
        >
          {clamped}
        </text>
        <text
          x={70}
          y={86}
          textAnchor="middle"
          fontSize={12}
          fill="#9c9c9c"
          className="font-[family-name:var(--font-poppins)]"
        >
          / 10
        </text>
      </svg>
      <span
        className="font-[family-name:var(--font-poppins)] font-semibold"
        style={{ fontSize: 13, color: band.textColor }}
      >
        {band.label}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/hub/account/interview/__tests__/InterviewScoreGauge.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean)

- [ ] **Step 6: Commit**

```bash
git add app/hub/account/interview/InterviewScoreGauge.tsx app/hub/account/interview/__tests__/InterviewScoreGauge.test.ts
git commit -m "feat(hub): add circular AI-interview score gauge"
```

---

### Task 4: `ParameterScoreTile`, `page.tsx` rewrite, delete `InterviewSkillCard`

**Files:**
- Create: `app/hub/account/interview/ParameterScoreTile.tsx`
- Modify: `app/hub/account/interview/page.tsx`
- Delete: `app/hub/account/interview/InterviewSkillCard.tsx` (only consumer is `page.tsx`, being rewritten to no longer use it)

**Interfaces:**
- Consumes: `InterviewScoreGauge` (Task 3), `InterviewReportReady.approxDurationMinutes` (Task 1/2), `getCandidateResumeDetails` (existing, from `lib/intervuebox/reports.ts`)
- Produces: nothing consumed further — this is the leaf/assembly task

- [ ] **Step 1: Create `ParameterScoreTile.tsx`**

No dedicated test — matches this repo's existing convention for presentational components (`InterviewSkillCard`, `ResumeMatchCategoryCard`, `CandidateProfile` have none either).

```tsx
function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export default function ParameterScoreTile({ skill, score }: { skill: string; score: number }) {
  return (
    <div className="bg-[#fdf8fb] border border-black/[0.08]" style={{ borderRadius: 12, padding: "14px 16px" }}>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11.5, margin: "0 0 6px" }}>
        {titleCase(skill)}
      </p>
      <p className="font-[family-name:var(--font-gabarito)] font-semibold text-[#ed1a24]" style={{ fontSize: "1.4rem", margin: 0 }}>
        {score}
        <span style={{ fontSize: 13, color: "#9c9c9c", fontWeight: 400 }}>/10</span>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the entire file with:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import { getCandidateResumeDetails } from "@/lib/intervuebox/reports";
import InterviewScoreGauge from "./InterviewScoreGauge";
import ParameterScoreTile from "./ParameterScoreTile";

// report.strengths/areasOfImprovement arrive as a single "- point\n- point"
// string (IntervueBox's own format), not an array like the fitment report's
// strongPoints/weakPoints — split so both report pages render bullet lists
// the same way.
function splitBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

export default async function InterviewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { role } = await searchParams;
  const roleTitle = typeof role === "string" ? role : null;

  let query = supabase
    .from("fitment_interviews")
    .select("role_title, status, report_raw, updated_at")
    .eq("user_id", user.id);

  if (roleTitle) {
    query = query.eq("role_title", roleTitle);
  }

  const { data: interview } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!interview || interview.status !== "ready" || !interview.report_raw) {
    redirect("/hub/account");
  }

  const report = interview.report_raw as InterviewReportReady;

  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("name, ib_applied_job_id")
    .eq("user_id", user.id)
    .eq("role_title", interview.role_title)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const candidateDetails = lead?.ib_applied_job_id
    ? await getCandidateResumeDetails(lead.ib_applied_job_id).catch((err) => {
        console.error("getCandidateResumeDetails failed, rendering interview report without organisation", err);
        return null;
      })
    : null;

  const organisation = candidateDetails?.experience[0]?.company ?? null;

  const displayName = lead?.name || user.email || "Candidate";
  const formattedDate = new Date(interview.updated_at).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const infoBarParts = [
    organisation,
    formattedDate,
    report.approxDurationMinutes != null ? `~${report.approxDurationMinutes} min` : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "48px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 900 }}>
        <Link
          href="/hub/account"
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ fontSize: 13 }}
        >
          ← Back to dashboard
        </Link>

        <div className="flex items-center justify-between flex-wrap" style={{ margin: "14px 0 4px", gap: 12 }}>
          <div>
            <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
              <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.8rem", margin: 0 }}>
                {displayName}
              </h1>
              <span
                className="bg-[#ed1a24] font-[family-name:var(--font-poppins)] font-semibold text-white"
                style={{ fontSize: 11.5, borderRadius: 50, padding: "4px 12px" }}
              >
                {interview.role_title}
              </span>
            </div>
            {infoBarParts.length > 0 && (
              <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, margin: "8px 0 0" }}>
                {infoBarParts.join(" · ")}
              </p>
            )}
          </div>
          <Image src="/logo.png" alt="Merito" width={100} height={28} style={{ height: 24, width: "auto" }} />
        </div>

        <div
          className="bg-white border border-black/[0.08]"
          style={{
            borderRadius: 14,
            padding: 20,
            margin: "20px 0 32px",
            display: "grid",
            gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div>
            <p
              className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
              style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 12px" }}
            >
              Parameters score
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
              {Object.entries(report.skillMetrics).map(([skill, score]) => (
                <ParameterScoreTile key={skill} skill={skill} score={score} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center">
            <InterviewScoreGauge score={report.overallScore} />
          </div>
        </div>

        <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, margin: "0 0 32px" }}>
          <p
            className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
            style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}
          >
            AI overview
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>
            {report.overallSummary}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14 }}>
          {report.strengths && (
            // Green tint matches the dashboard's own "Top strengths" card
            // (design_handoff_merito_hub/dashboard/Merito HUB Dashboard.dc.html)
            // rather than a plain white/bordered card.
            <div className="bg-[#eefdf1]" style={{ borderRadius: 14, padding: "14px 16px" }}>
              <p
                className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#16803c]"
                style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}
              >
                Strengths
              </p>
              {splitBullets(report.strengths).map((point, i) => (
                <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.7, margin: "0 0 8px" }}>
                  ✓ {point}
                </p>
              ))}
            </div>
          )}

          {report.areasOfImprovement && (
            // Red tint matches the dashboard's own "Gaps costing you
            // shortlists" card in the same reference file.
            <div className="bg-[#fdeced]" style={{ borderRadius: 14, padding: "14px 16px" }}>
              <p
                className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]"
                style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}
              >
                Areas to improve
              </p>
              {splitBullets(report.areasOfImprovement).map((point, i) => (
                <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.7, margin: "0 0 8px" }}>
                  ✗ {point}
                </p>
              ))}
            </div>
          )}
        </div>

        {report.shareableReportLink && (
          <a
            href={report.shareableReportLink}
            target="_blank"
            rel="noreferrer"
            className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
            style={{ fontSize: 13, display: "inline-block", marginTop: 32 }}
          >
            View full report on IntervueBox →
          </a>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Delete the now-unused `InterviewSkillCard.tsx`**

```bash
git rm app/hub/account/interview/InterviewSkillCard.tsx
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean)

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (no test referenced `InterviewSkillCard` directly, so none should break)

- [ ] **Step 6: Manual live verification**

The `HR Business Partner` interview row from this session's live testing is already `status: "ready"` with real `report_raw` data (missing only `approxDurationMinutes`, which will just render as omitted from the info bar — not an error). With the dev server running:
1. Navigate to `http://localhost:3000/hub/account/interview?role=HR%20Business%20Partner`
2. Confirm: name + red role pill in header, info bar shows organisation/date (duration may be blank for this pre-existing row), Parameters Score grid (5 tiles), circular gauge showing `8/10` in green ("Strong"), AI overview paragraph, two-column Strengths/Areas-to-improve, IntervueBox link
3. Take a screenshot or accessibility snapshot to confirm no console errors and no "Objects are not valid as a React child" crash

- [ ] **Step 7: Commit**

```bash
git add app/hub/account/interview/ParameterScoreTile.tsx app/hub/account/interview/page.tsx
git commit -m "feat(hub): redesign AI-interview report page to match reference PDF layout with Merito branding"
```
