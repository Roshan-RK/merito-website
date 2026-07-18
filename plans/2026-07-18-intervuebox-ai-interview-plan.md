# IntervueBox AI Interview (Phase C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real AI interview flow that fills in `ProgressRail`'s existing "Mock AI interview — Coming soon" step: candidate clicks to start, IntervueBox emails them an interview link, they take the interview on IntervueBox's own platform, a webhook tells Merito when the report is ready, and a new dashboard page renders it.

**Architecture:** Extends the existing `lib/intervuebox/` module with three new resource files (`agents.ts`, `invitations.ts`, `interviewReports.ts`) plus one addition to the existing `applicants.ts`. A new `fitment_interviews` table (keyed like `report_unlocks`/`fitment_reports` by `user_id, role_title`) tracks per-candidate interview state. Because the exact webhook payload body shape is undocumented (confirmed in `specs/2026-07-17-intervuebox-integration-design.md`, Open Item #2), the webhook handler doesn't parse the delivery body for identifiers at all — on any validly-signed hit it re-checks every `fitment_interviews` row still in `invited` status against IntervueBox's Reports API directly, using IDs Merito already stored at invitation time. This sidesteps the undocumented shape entirely instead of guessing at it.

**Tech Stack:** Same as the Phase A/B plan — Next.js 16.2.4 App Router, `@supabase/supabase-js` service-role client, Vitest with hand-rolled `fetch`/Supabase-chain mocks. No new dependencies; webhook signature verification uses Node's built-in `crypto`.

## Global Constraints

- **Prerequisite:** Phase A/B (`plans/2026-07-17-intervuebox-integration-plan.md`) is already implemented and committed — `lib/intervuebox/{client,jobs,resumes,applicants,reports}.ts` exist, `fitment_leads` already has `ib_job_id`/`ib_applied_job_id`. This plan builds on top, does not modify Phase A/B's tested behavior except one additive export (Task 2).
- **Confirmed live endpoint schemas** (from `specs/2026-07-17-intervuebox-integration-design.md`, itself fetched verbatim from `https://manavrittisolutionspvtltd.mintlify.app/api/*.md` on 2026-07-17):
  - `POST /public/jobs/:jobId/interview` body `{ maxInterviewMinutes: 15|30|45, interviewType: "technical"|"managerial"|"hr", isCriteriaMatch?: boolean }` → `{ interviewId, title, status, maxInterviewMinutes, interviewType, isCriteriaMatch }`. Only one interview agent per job; this plan defaults to `{ maxInterviewMinutes: 30, interviewType: "technical", isCriteriaMatch: false }` since Merito's flow doesn't collect interview-type preference from the candidate.
  - `GET /public/applicants/:appliedJobId` → includes `candidateId` (needed for the invitation call; Phase A's `addApplicant` discarded this field, so it's re-fetched here rather than touching Phase A's tested insert path).
  - `POST /public/invitations/interviews/:interviewId` body `{ candidateIds: string[] }` → `{ success, invited, failed, results: [{candidateId, success}], errors?: [{candidateId, error}] }`. **No link field** — IntervueBox emails the candidate directly ("Candidates will receive an email invitation with a link to start the interview"). Dashboard copy after triggering must say "check your email," not offer a button.
  - `GET /public/reports/interviews` — unusually, this is a `GET` with a JSON request body `{ interviewId, candidateId }` (confirmed verbatim in the docs' own curl/JS/Python examples, repeated identically for `/reports/assessments` and `/reports/calling-agents`). Returns `404` with `{"message": "Report is not available for this candidate yet"}` before the candidate finishes — not a `PENDING` status field like resume-match, an actual `404`. Ready response: `{ interviewSessionId, shareableReportLink, sessionDetails: { overallSkillScore, skillReport: {technical, communication, problemSolving, ...}, overallReport, answers, interviewStartTime, interviewEndTime, status, ... }, candidateDetails }`.
  - Webhook signing (from `https://manavrittisolutionspvtltd.mintlify.app/api/webhooks.md`, verbatim): HMAC-SHA256 over `` `${timestamp}.${raw_body}` ``, secret configured per-endpoint in the IntervueBox dashboard. Single header `X-IB-Signature: t=<unix_ts>,v1=<hex_hmac>` (a separate `X-IB-Timestamp` header repeats the same timestamp but isn't needed since `t` is already inside `X-IB-Signature`). Event names include `AIInterviewReportGenerated` and `ApplicantAIInterviewStatusChanged`, but the JSON body shape per event is **not** documented — see Architecture note above on why this plan doesn't depend on it.
- **`fitment_interviews` status model is deliberately binary: `invited` / `ready`.** No `in_progress`/`completed` intermediate states, because nothing in the documented API lets us reliably distinguish those — the Reports API only ever tells us "404, not ready" or "200, ready." Modeling states we can't actually observe would be a fabrication, not a feature.
- **Migration numbering:** last applied is `0007_intervuebox_resume_match.sql` (`0006` is reserved by a separate not-yet-shipped sibling plan, per that plan's own note — still not shipped, confirmed via `ls supabase/migrations`). This plan's migration is `0008_fitment_interviews.sql`.
- **No test files for presentational UI components** (`ProgressRail.tsx`, `InterviewStartModal.tsx`, `InterviewSkillCard.tsx`, the new `interview/page.tsx`) — matches this repo's existing convention: `ScoreCard.tsx`, `ProgressRail.tsx`, `ReportPaywallModal.tsx`, and the existing `report/page.tsx`/`ResumeMatchCategoryCard.tsx` have no test files today; only `lib/` modules and API routes are unit-tested here.
- **Interview step has no paywall** — confirmed design decision: independent of the ₹299 `report` unlock, free to trigger for now. Monetizing it is explicitly out of scope.
- Env var: `INTERVUEBOX_WEBHOOK_SECRET` (new, added in Task 7). `INTERVUEBOX_API_KEY`/`INTERVUEBOX_BASE_URL` already exist from Phase A/B.
- Match existing code style: double quotes, semicolons, one exported concern per `lib/` file, Tailwind arbitrary-value classNames mixed with inline `style={}` (see `ReportPaywallModal.tsx`, `ProgressRail.tsx`).
- Test command: `npx vitest run <path>`. Mock `fetch`/Supabase chains by hand exactly as `app/api/hub/unlock-report/__tests__/route.test.ts` and `lib/intervuebox/__tests__/*.test.ts` already do.
- Migrations are applied by hand in the Supabase SQL editor, never automatically.
- Never `git add -A`; stage explicitly.

---

### Task 1: `lib/intervuebox/agents.ts` — create interview agent

**Files:**
- Create: `lib/intervuebox/agents.ts`
- Test: `lib/intervuebox/__tests__/agents.test.ts`

**Interfaces:**
- Consumes: `intervueBoxFetch<T>(path, init)` from `./client`.
- Produces: `createInterviewAgent(jobId: string): Promise<{ ibAgentId: string }>` — consumed by Task 6.

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\__tests__\agents.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("createInterviewAgent", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("posts default interview settings and returns the interview id", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      interviewId: "INT_123",
      title: "Technical Interview",
      status: "ACTIVE",
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
    });
    const { createInterviewAgent } = await import("../agents");

    const result = await createInterviewAgent("JOB_123");

    expect(result).toEqual({ ibAgentId: "INT_123" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/jobs/JOB_123/interview",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/intervuebox/__tests__/agents.test.ts`
Expected: FAIL (module `../agents` not found)

- [ ] **Step 3: Write the implementation**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\agents.ts`:

```ts
import { intervueBoxFetch } from "./client";

type CreateInterviewAgentResponse = {
  interviewId: string;
  title: string;
  status: string;
  maxInterviewMinutes: number;
  interviewType: string;
  isCriteriaMatch: boolean;
};

export async function createInterviewAgent(jobId: string): Promise<{ ibAgentId: string }> {
  const response = await intervueBoxFetch<CreateInterviewAgentResponse>(`/public/jobs/${jobId}/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maxInterviewMinutes: 30,
      interviewType: "technical",
      isCriteriaMatch: false,
    }),
  });
  return { ibAgentId: response.interviewId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/intervuebox/__tests__/agents.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/intervuebox/agents.ts lib/intervuebox/__tests__/agents.test.ts
git commit -m "feat: add IntervueBox createInterviewAgent"
```

---

### Task 2: `lib/intervuebox/applicants.ts` — add `getApplicant`

**Files:**
- Modify: `lib/intervuebox/applicants.ts`
- Modify: `lib/intervuebox/__tests__/applicants.test.ts`

**Interfaces:**
- Consumes: `intervueBoxFetch<T>(path, init)` from `./client`.
- Produces: `getApplicant(appliedJobId: string): Promise<{ candidateId: string }>` (new export, additive) — consumed by Task 6. Existing `addApplicant` export and its behavior are unchanged.

- [ ] **Step 1: Add the failing test**

Append to `d:\Work-Projects\merito-website-v2\lib\intervuebox\__tests__\applicants.test.ts` (after the existing `describe("addApplicant", ...)` block, same file, same mock setup already at the top):

```ts
describe("getApplicant", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("fetches applicant detail and returns the candidate id", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      applicantId: "APJ_123",
      candidateId: "USR_123",
      candidateName: "Jane Doe",
      candidateEmail: "jane@example.com",
    });
    const { getApplicant } = await import("../applicants");

    const result = await getApplicant("APJ_123");

    expect(result).toEqual({ candidateId: "USR_123" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith("/public/applicants/APJ_123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/intervuebox/__tests__/applicants.test.ts`
Expected: FAIL (`getApplicant` is not exported)

- [ ] **Step 3: Add the implementation**

Append to `d:\Work-Projects\merito-website-v2\lib\intervuebox\applicants.ts` (after the existing `addApplicant` function, same file):

```ts
type GetApplicantResponse = {
  applicantId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
};

export async function getApplicant(appliedJobId: string): Promise<{ candidateId: string }> {
  const response = await intervueBoxFetch<GetApplicantResponse>(`/public/applicants/${appliedJobId}`);
  return { candidateId: response.candidateId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/intervuebox/__tests__/applicants.test.ts`
Expected: PASS (2 tests — original `addApplicant` test plus new `getApplicant` test)

- [ ] **Step 5: Commit**

```bash
git add lib/intervuebox/applicants.ts lib/intervuebox/__tests__/applicants.test.ts
git commit -m "feat: add IntervueBox getApplicant"
```

---

### Task 3: `lib/intervuebox/invitations.ts`

**Files:**
- Create: `lib/intervuebox/invitations.ts`
- Test: `lib/intervuebox/__tests__/invitations.test.ts`

**Interfaces:**
- Consumes: `intervueBoxFetch<T>(path, init)` from `./client`.
- Produces: `sendInterviewInvitation(interviewId: string, candidateIds: string[]): Promise<{ invited: number; failed: number }>` — consumed by Task 6.

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\__tests__\invitations.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("sendInterviewInvitation", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("posts candidate ids and returns invited/failed counts", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      success: true,
      invited: 1,
      failed: 0,
      results: [{ candidateId: "USR_123", success: true }],
    });
    const { sendInterviewInvitation } = await import("../invitations");

    const result = await sendInterviewInvitation("INT_123", ["USR_123"]);

    expect(result).toEqual({ invited: 1, failed: 0 });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/invitations/interviews/INT_123",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({ candidateIds: ["USR_123"] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/intervuebox/__tests__/invitations.test.ts`
Expected: FAIL (module `../invitations` not found)

- [ ] **Step 3: Write the implementation**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\invitations.ts`:

```ts
import { intervueBoxFetch } from "./client";

type SendInterviewInvitationResponse = {
  success: boolean;
  invited: number;
  failed: number;
  results: { candidateId: string; success: boolean }[];
  errors?: { candidateId: string; error: string }[];
};

export async function sendInterviewInvitation(
  interviewId: string,
  candidateIds: string[]
): Promise<{ invited: number; failed: number }> {
  const response = await intervueBoxFetch<SendInterviewInvitationResponse>(
    `/public/invitations/interviews/${interviewId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds }),
    }
  );
  return { invited: response.invited, failed: response.failed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/intervuebox/__tests__/invitations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/intervuebox/invitations.ts lib/intervuebox/__tests__/invitations.test.ts
git commit -m "feat: add IntervueBox sendInterviewInvitation"
```

---

### Task 4: `lib/intervuebox/interviewReports.ts`

**Files:**
- Create: `lib/intervuebox/interviewReports.ts`
- Test: `lib/intervuebox/__tests__/interviewReports.test.ts`

**Interfaces:**
- Consumes: `intervueBoxFetch<T>(path, init)` and `IntervueBoxError` from `./client`.
- Produces:
  - `type InterviewReportReady = { overallSkillScore: number; skillReport: Record<string, number>; overallReport: string; shareableReportLink: string | null }`
  - `type InterviewReport = { status: "NOT_READY" } | ({ status: "READY" } & InterviewReportReady)`
  - `getInterviewReport(interviewId: string, candidateId: string): Promise<InterviewReport>` — consumed by Task 7 (webhook sweep) and Task 9/11 (UI types).

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\__tests__\interviewReports.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => {
  class IntervueBoxError extends Error {
    code: string;
    status: number;
    details?: unknown;
    constructor(shape: { code: string; message: string; status: number; details?: unknown }) {
      super(shape.message);
      this.name = "IntervueBoxError";
      this.code = shape.code;
      this.status = shape.status;
      this.details = shape.details;
    }
  }
  return { intervueBoxFetch: intervueBoxFetchMock, IntervueBoxError };
});

describe("getInterviewReport", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("maps a ready report into the typed shape", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      interviewSessionId: "ISE_123",
      shareableReportLink: "https://app.intervuebox.com/reports/ISE_123",
      sessionDetails: {
        overallSkillScore: 85,
        skillReport: { technical: 85, communication: 90, problemSolving: 80 },
        overallReport: "Strong candidate.",
        status: "Completed",
      },
    });
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toEqual({
      status: "READY",
      overallSkillScore: 85,
      skillReport: { technical: 85, communication: 90, problemSolving: 80 },
      overallReport: "Strong candidate.",
      shareableReportLink: "https://app.intervuebox.com/reports/ISE_123",
    });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/reports/interviews",
      expect.objectContaining({ method: "GET", headers: { "Content-Type": "application/json" } })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({ interviewId: "INT_123", candidateId: "USR_123" });
  });

  it("returns NOT_READY when IntervueBox responds 404", async () => {
    const { IntervueBoxError } = await import("../client");
    intervueBoxFetchMock.mockRejectedValue(
      new IntervueBoxError({ code: "not_found", message: "Report is not available for this candidate yet", status: 404 })
    );
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toEqual({ status: "NOT_READY" });
  });

  it("re-throws non-404 errors", async () => {
    const { IntervueBoxError } = await import("../client");
    intervueBoxFetchMock.mockRejectedValue(
      new IntervueBoxError({ code: "unauthorized", message: "bad key", status: 401 })
    );
    const { getInterviewReport } = await import("../interviewReports");

    await expect(getInterviewReport("INT_123", "USR_123")).rejects.toThrow("bad key");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/intervuebox/__tests__/interviewReports.test.ts`
Expected: FAIL (module `../interviewReports` not found)

- [ ] **Step 3: Write the implementation**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\interviewReports.ts`:

```ts
import { intervueBoxFetch, IntervueBoxError } from "./client";

export type InterviewReportReady = {
  overallSkillScore: number;
  skillReport: Record<string, number>;
  overallReport: string;
  shareableReportLink: string | null;
};

export type InterviewReport = { status: "NOT_READY" } | ({ status: "READY" } & InterviewReportReady);

type RawInterviewReportResponse = {
  interviewSessionId: string;
  shareableReportLink: string | null;
  sessionDetails: {
    overallSkillScore: number;
    skillReport: Record<string, number>;
    overallReport: string;
  };
};

export async function getInterviewReport(interviewId: string, candidateId: string): Promise<InterviewReport> {
  try {
    const response = await intervueBoxFetch<RawInterviewReportResponse>("/public/reports/interviews", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId, candidateId }),
    });
    return {
      status: "READY",
      overallSkillScore: response.sessionDetails.overallSkillScore,
      skillReport: response.sessionDetails.skillReport,
      overallReport: response.sessionDetails.overallReport,
      shareableReportLink: response.shareableReportLink,
    };
  } catch (err) {
    if (err instanceof IntervueBoxError && err.status === 404) {
      return { status: "NOT_READY" };
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/intervuebox/__tests__/interviewReports.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/intervuebox/interviewReports.ts lib/intervuebox/__tests__/interviewReports.test.ts
git commit -m "feat: add IntervueBox interview report client"
```

---

### Task 5: Database migration — `fitment_interviews` table

**Files:**
- Create: `supabase/migrations/0008_fitment_interviews.sql`

**Interfaces:**
- Produces: table `fitment_interviews(user_id, role_title, ib_job_id, ib_agent_id, ib_candidate_id, status, report_raw, invited_at, updated_at)`, primary key `(user_id, role_title)` — consumed by Tasks 6, 7, 9, 10, 11.

- [ ] **Step 1: Write the migration**

Create `d:\Work-Projects\merito-website-v2\supabase\migrations\0008_fitment_interviews.sql`:

```sql
create table if not exists fitment_interviews (
  user_id uuid not null references auth.users(id),
  role_title text not null,
  ib_job_id text not null,
  ib_agent_id text not null,
  ib_candidate_id text not null,
  status text not null default 'invited' check (status in ('invited', 'ready')),
  report_raw jsonb,
  invited_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role_title)
);

alter table fitment_interviews enable row level security;

drop policy if exists "Users can view their own AI interviews" on fitment_interviews;

create policy "Users can view their own AI interviews"
  on fitment_interviews
  for select
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply by hand in the Supabase SQL editor**

Not applied automatically. Route tests (Task 6, 7) mock Supabase entirely and pass without this being applied; a real database needs it run before Tasks 6/7 work end-to-end.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_fitment_interviews.sql
git commit -m "feat: add fitment_interviews table"
```

---

### Task 6: `POST /api/hub/start-ai-interview`

**Files:**
- Create: `app/api/hub/start-ai-interview/route.ts`
- Test: `app/api/hub/start-ai-interview/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getApplicant` (Task 2), `createInterviewAgent` (Task 1), `sendInterviewInvitation` (Task 3), `fitment_interviews`/`fitment_leads` tables.
- Produces: `POST /api/hub/start-ai-interview` body `{ roleTitle: string }` → `{ status: "invited" }` or `{ status: "ready" }` (idempotent re-check) or `{ error: string }` — consumed by Task 9 (`InterviewStartModal.tsx`).

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\start-ai-interview\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: sessionFromMock,
  }),
}));

const existingMaybeSingleMock = vi.fn();
const existingEq2Mock = vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingleMock });
const existingEq1Mock = vi.fn().mockReturnValue({ eq: existingEq2Mock });
const existingSelectMock = vi.fn().mockReturnValue({ eq: existingEq1Mock });

const leadMaybeSingleMock = vi.fn();
const leadLimitMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEq2Mock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadEq1Mock = vi.fn().mockReturnValue({ eq: leadEq2Mock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEq1Mock });

const sessionFromMock = vi.fn((table: string) => {
  if (table === "fitment_interviews") return { select: existingSelectMock };
  if (table === "fitment_leads") return { select: leadSelectMock };
  throw new Error(`Unexpected table ${table}`);
});

const insertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: () => ({ insert: insertMock }) }),
}));

const getApplicantMock = vi.fn();
vi.mock("@/lib/intervuebox/applicants", () => ({ getApplicant: getApplicantMock }));
const createInterviewAgentMock = vi.fn();
vi.mock("@/lib/intervuebox/agents", () => ({ createInterviewAgent: createInterviewAgentMock }));
const sendInterviewInvitationMock = vi.fn();
vi.mock("@/lib/intervuebox/invitations", () => ({ sendInterviewInvitation: sendInterviewInvitationMock }));

async function importRoute() {
  return await import("../route");
}

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/hub/start-ai-interview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/hub/start-ai-interview", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    existingMaybeSingleMock.mockReset();
    leadMaybeSingleMock.mockReset();
    insertMock.mockClear();
    insertMock.mockResolvedValue({ error: null });
    getApplicantMock.mockReset();
    createInterviewAgentMock.mockReset();
    sendInterviewInvitationMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when roleTitle is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(400);
  });

  it("returns the existing status idempotently without re-inviting when a row already exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: { status: "ready" }, error: null });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(sendInterviewInvitationMock).not.toHaveBeenCalled();
  });

  it("returns 400 when no fitment_leads row exists for this role", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(400);
  });

  it("creates the interview agent, sends the invite, and saves an invited row", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "invited" });
    expect(createInterviewAgentMock).toHaveBeenCalledWith("JOB_123");
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

  it("returns 500 if the IntervueBox chain fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123" },
      error: null,
    });
    getApplicantMock.mockRejectedValue(new Error("boom"));

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/hub/start-ai-interview/__tests__/route.test.ts`
Expected: FAIL (module `../route` not found)

- [ ] **Step 3: Write the route**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\start-ai-interview\route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getApplicant } from "@/lib/intervuebox/applicants";
import { createInterviewAgent } from "@/lib/intervuebox/agents";
import { sendInterviewInvitation } from "@/lib/intervuebox/invitations";

export const runtime = "nodejs";

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

  const { data: existing } = await supabase
    .from("fitment_interviews")
    .select("status")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .maybeSingle();

  if (existing) {
    return Response.json({ status: existing.status === "ready" ? "ready" : "invited" });
  }

  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("ib_job_id, ib_applied_job_id")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ error: "No fitment check found for this role." }, { status: 400 });
  }

  let candidateId: string;
  let ibAgentId: string;
  try {
    ({ candidateId } = await getApplicant(lead.ib_applied_job_id));
    ({ ibAgentId } = await createInterviewAgent(lead.ib_job_id));
    await sendInterviewInvitation(ibAgentId, [candidateId]);
  } catch (err) {
    console.error("IntervueBox interview-invite chain failed", { jobId: lead.ib_job_id, error: err });
    return Response.json(
      { error: "Something went wrong starting your AI interview — please try again." },
      { status: 500 }
    );
  }

  const admin = getSupabaseServerClient();
  const { error: insertError } = await admin.from("fitment_interviews").insert({
    user_id: user.id,
    role_title: roleTitle,
    ib_job_id: lead.ib_job_id,
    ib_agent_id: ibAgentId,
    ib_candidate_id: candidateId,
    status: "invited",
  });

  if (insertError) {
    return Response.json(
      { error: "Invitation sent, but we couldn't save the status — please refresh." },
      { status: 500 }
    );
  }

  return Response.json({ status: "invited" });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/hub/start-ai-interview/__tests__/route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/start-ai-interview/route.ts app/api/hub/start-ai-interview/__tests__/route.test.ts
git commit -m "feat: add start-ai-interview route"
```

---

### Task 7: Webhook receiver — `POST /api/webhooks/intervuebox`

**Files:**
- Create: `app/api/webhooks/intervuebox/route.ts`
- Test: `app/api/webhooks/intervuebox/__tests__/route.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `getInterviewReport` (Task 4), `fitment_interviews` table.
- Produces: `POST /api/webhooks/intervuebox` → `200 { received: true }` on any validly-signed request (sweeps and updates rows internally), `401` on an invalid/missing signature.

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\app\api\webhooks\intervuebox\__tests__\route.test.ts`:

```ts
import crypto from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getInterviewReportMock = vi.fn();
vi.mock("@/lib/intervuebox/interviewReports", () => ({
  getInterviewReport: getInterviewReportMock,
}));

const selectEqMock = vi.fn();
const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock });
const updateEq2Mock = vi.fn().mockResolvedValue({ error: null });
const updateEq1Mock = vi.fn().mockReturnValue({ eq: updateEq2Mock });
const updateMock = vi.fn().mockReturnValue({ eq: updateEq1Mock });
const fromMock = vi.fn().mockReturnValue({ select: selectMock, update: updateMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importRoute() {
  return await import("../route");
}

function sign(secret: string, rawBody: string, timestamp = "1700000000") {
  const hmac = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

describe("POST /api/webhooks/intervuebox", () => {
  beforeEach(() => {
    vi.stubEnv("INTERVUEBOX_WEBHOOK_SECRET", "whsec_test");
    getInterviewReportMock.mockReset();
    selectEqMock.mockReset();
    updateEq2Mock.mockClear();
    updateEq2Mock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when the signature is missing", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/webhooks/intervuebox", {
      method: "POST",
      body: JSON.stringify({ eventType: "AIInterviewReportGenerated" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 401 when the signature doesn't match", async () => {
    const { POST } = await importRoute();
    const rawBody = JSON.stringify({ eventType: "AIInterviewReportGenerated" });
    const request = new Request("http://localhost/api/webhooks/intervuebox", {
      method: "POST",
      headers: { "x-ib-signature": "t=1700000000,v1=deadbeef" },
      body: rawBody,
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("sweeps invited rows, updates the one whose report is ready, and returns 200", async () => {
    selectEqMock.mockResolvedValue({
      data: [
        { user_id: "user-1", role_title: "Senior Product Manager", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
        { user_id: "user-2", role_title: "Backend Engineer", ib_agent_id: "INT_2", ib_candidate_id: "USR_2" },
      ],
      error: null,
    });
    getInterviewReportMock.mockImplementation(async (interviewId: string) => {
      if (interviewId === "INT_1") {
        return {
          status: "READY",
          overallSkillScore: 85,
          skillReport: { technical: 85 },
          overallReport: "Strong candidate.",
          shareableReportLink: "https://app.intervuebox.com/reports/ISE_1",
        };
      }
      return { status: "NOT_READY" };
    });

    const { POST } = await importRoute();
    const rawBody = JSON.stringify({ eventType: "AIInterviewReportGenerated" });
    const request = new Request("http://localhost/api/webhooks/intervuebox", {
      method: "POST",
      headers: { "x-ib-signature": sign("whsec_test", rawBody) },
      body: rawBody,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(getInterviewReportMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready" })
    );
    expect(updateEq1Mock).toHaveBeenCalledWith("user_id", "user-1");
    expect(updateEq2Mock).toHaveBeenCalledWith("role_title", "Senior Product Manager");
  });

  it("returns 200 with no updates when there are no invited rows", async () => {
    selectEqMock.mockResolvedValue({ data: [], error: null });
    const { POST } = await importRoute();
    const rawBody = JSON.stringify({ eventType: "AIInterviewReportGenerated" });
    const request = new Request("http://localhost/api/webhooks/intervuebox", {
      method: "POST",
      headers: { "x-ib-signature": sign("whsec_test", rawBody) },
      body: rawBody,
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/webhooks/intervuebox/__tests__/route.test.ts`
Expected: FAIL (module `../route` not found)

- [ ] **Step 3: Write the route**

Create `d:\Work-Projects\merito-website-v2\app\api\webhooks\intervuebox\route.ts`:

```ts
import crypto from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getInterviewReport } from "@/lib/intervuebox/interviewReports";

export const runtime = "nodejs";

function verifySignature(secret: string, rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => kv.split("=").map((s) => s.trim()))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");
  // timingSafeEqual throws on length mismatch instead of returning false —
  // guard explicitly so a malformed signature 401s instead of 500ing.
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

export async function POST(request: Request) {
  const secret = process.env.INTERVUEBOX_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-ib-signature");
  if (!verifySignature(secret, rawBody, signatureHeader)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  // The webhook delivery body's per-event JSON shape isn't documented by
  // IntervueBox, so this handler doesn't parse it for identifiers at all.
  // Instead, any validly-signed hit re-checks every row we ourselves still
  // have as "invited" against the Reports API, using IDs captured at
  // invitation time (see specs/2026-07-17-intervuebox-integration-design.md,
  // Open Item #2).
  const supabase = getSupabaseServerClient();
  const { data: pending, error: pendingError } = await supabase
    .from("fitment_interviews")
    .select("user_id, role_title, ib_agent_id, ib_candidate_id")
    .eq("status", "invited");

  if (pendingError || !pending) {
    return Response.json({ received: true });
  }

  for (const row of pending) {
    try {
      const report = await getInterviewReport(row.ib_agent_id, row.ib_candidate_id);
      if (report.status !== "READY") continue;

      await supabase
        .from("fitment_interviews")
        .update({
          status: "ready",
          report_raw: {
            overallSkillScore: report.overallSkillScore,
            skillReport: report.skillReport,
            overallReport: report.overallReport,
            shareableReportLink: report.shareableReportLink,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id)
        .eq("role_title", row.role_title);
    } catch (err) {
      console.error("Webhook sweep: getInterviewReport failed for a pending row", { row, error: err });
    }
  }

  return Response.json({ received: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/webhooks/intervuebox/__tests__/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Add the webhook secret env var**

In `d:\Work-Projects\merito-website-v2\.env.example`, add after the `INTERVUEBOX_BASE_URL` line:

```
INTERVUEBOX_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 6: Commit**

```bash
git add app/api/webhooks/intervuebox/route.ts app/api/webhooks/intervuebox/__tests__/route.test.ts .env.example
git commit -m "feat: add IntervueBox webhook receiver"
```

---

### Task 8: `ProgressRail.tsx` — make the interview step interactive

**Files:**
- Modify: `app/hub/account/ProgressRail.tsx` (full-file replace)

**Interfaces:**
- Produces: `export type InterviewStatus = "not_started" | "invited" | "ready"`; `ProgressRail` now takes `interviewStatus: InterviewStatus` and `onOpenInterviewStart: () => void` props in addition to its existing `reportUnlocked`/`onOpenReportPaywall` — consumed by Task 9 (`DashboardClient.tsx`) and Task 10 (`account/page.tsx`, for the type import).
- No test — matches existing convention (this file has no test today).

- [ ] **Step 1: Replace the full file**

Replace the full contents of `d:\Work-Projects\merito-website-v2\app\hub\account\ProgressRail.tsx`:

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

const STEPS = [
  { key: "score", label: "Job fitment score" },
  { key: "report", label: "Detailed report" },
  { key: "personality", label: "Personality test" },
  { key: "references", label: "Reference checks" },
  { key: "interview", label: "Mock AI interview" },
] as const;

export type InterviewStatus = "not_started" | "invited" | "ready";

export default function ProgressRail({
  reportUnlocked,
  interviewStatus,
  onOpenReportPaywall,
  onOpenInterviewStart,
}: {
  reportUnlocked: boolean;
  interviewStatus: InterviewStatus;
  onOpenReportPaywall: () => void;
  onOpenInterviewStart: () => void;
}) {
  const doneCount = 1 + (reportUnlocked ? 1 : 0) + (interviewStatus === "ready" ? 1 : 0);
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
          const isReportLocked = step.key === "report" && !reportUnlocked;
          const isComingSoon = step.key === "personality" || step.key === "references";
          const isInterviewStep = step.key === "interview";

          const isDone =
            step.key === "score" ||
            (step.key === "report" && reportUnlocked) ||
            (isInterviewStep && interviewStatus === "ready");

          let rightBadge: ReactNode = null;
          if (isComingSoon) {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11 }}>
                Coming soon
              </span>
            );
          } else if (isReportLocked) {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 11 }}>
                ₹299
              </span>
            );
          } else if (isInterviewStep && interviewStatus === "invited") {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#9c9c9c]" style={{ fontSize: 11 }}>
                Invited
              </span>
            );
          } else if (isInterviewStep && interviewStatus === "not_started") {
            rightBadge = (
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 11 }}>
                Start
              </span>
            );
          }

          const isClickable = isReportLocked || (isInterviewStep && interviewStatus === "not_started");
          const isLinkable = isInterviewStep && interviewStatus === "ready";

          const rowStyle: CSSProperties = {
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 12,
            minHeight: 44,
            cursor: isClickable || isLinkable ? "pointer" : "default",
            borderLeft: isClickable ? "5px solid #ed1a24" : "5px solid transparent",
          };
          const rowClassName = isDone ? "bg-[#eefdf1]" : isClickable ? "bg-[#fdf8fb]" : "bg-white";

          const content = (
            <>
              <div
                className={isDone ? "bg-[#eefdf1] text-[#16803c]" : isComingSoon ? "bg-[#f0e6ea] text-[#9c9c9c]" : "bg-[#fdeced] text-[#ed1a24]"}
                style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, flex: 1 }}>
                {step.label}
              </span>
              {rightBadge}
            </>
          );

          if (isLinkable) {
            return (
              <Link key={step.key} href="/hub/account/interview" className={rowClassName} style={rowStyle}>
                {content}
              </Link>
            );
          }

          return (
            <div
              key={step.key}
              onClick={
                isReportLocked
                  ? onOpenReportPaywall
                  : isInterviewStep && interviewStatus === "not_started"
                    ? onOpenInterviewStart
                    : undefined
              }
              className={rowClassName}
              style={rowStyle}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/hub/account/ProgressRail.tsx
git commit -m "feat: make the Mock AI interview progress step interactive"
```

---

### Task 9: `InterviewStartModal.tsx` + wire into `DashboardClient.tsx`

**Files:**
- Create: `app/hub/account/InterviewStartModal.tsx`
- Modify: `app/hub/account/DashboardClient.tsx` (full-file replace)

**Interfaces:**
- Consumes: `POST /api/hub/start-ai-interview` (Task 6), `InterviewStatus` type (Task 8).
- Produces: `DashboardClient` now takes an additional `initialInterviewStatus: InterviewStatus` prop — consumed by Task 10 (`account/page.tsx`).
- No tests — matches existing convention (`ReportPaywallModal.tsx`, `DashboardClient.tsx` have no test files today).

- [ ] **Step 1: Create the modal**

Create `d:\Work-Projects\merito-website-v2\app\hub\account\InterviewStartModal.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function InterviewStartModal({
  roleTitle,
  onClose,
  onStarted,
}: {
  roleTitle: string;
  onClose: () => void;
  onStarted: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/start-ai-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStarting(false);
        setError(data.error || "Something went wrong — please try again.");
        return;
      }
      setStarting(false);
      onStarted();
    } catch {
      setStarting(false);
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
        style={{ maxWidth: 480, width: "100%", borderRadius: 24, padding: 28, position: "relative" }}
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
          Mock AI Interview
        </span>
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
          Ready for a real AI interview?
        </h2>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
          We&apos;ll send you an email with a link to start your AI interview for {roleTitle}. Complete it whenever
          you&apos;re ready — your report will show up here once it&apos;s done.
        </p>

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ height: 50, borderRadius: 8, fontSize: 15, background: starting ? "#dcdcdc" : "#ed1a24", border: "none", cursor: starting ? "default" : "pointer", boxShadow: starting ? "none" : "0 4px 6px rgba(236,34,40,0.3)" }}
        >
          {starting ? "Sending invite…" : "Send me my interview invite"}
        </button>

        {error && <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `DashboardClient.tsx`**

Replace the full contents of `d:\Work-Projects\merito-website-v2\app\hub\account\DashboardClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import TopBar from "./TopBar";
import ProgressRail, { type InterviewStatus } from "./ProgressRail";
import ScoreCard from "./ScoreCard";
import ReportPaywallModal from "./ReportPaywallModal";
import ChangeRoleModal from "./ChangeRoleModal";
import InterviewStartModal from "./InterviewStartModal";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";

export default function DashboardClient({
  roleTitle,
  score,
  prevScore,
  verdict,
  initialReportUnlocked,
  initialReport,
  initialInterviewStatus,
}: {
  roleTitle: string;
  score: number;
  prevScore: number | null;
  verdict: string;
  initialReportUnlocked: boolean;
  initialReport: ResumeMatchReportReady | null;
  initialInterviewStatus: InterviewStatus;
}) {
  const [modal, setModal] = useState<"none" | "report" | "changeRole" | "interview">("none");
  const [reportUnlocked, setReportUnlocked] = useState(initialReportUnlocked);
  const [report, setReport] = useState<ResumeMatchReportReady | null>(initialReport);
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>(initialInterviewStatus);

  return (
    <>
      <TopBar roleTitle={roleTitle} onChangeRole={() => setModal("changeRole")} />

      <div
        className="mx-auto"
        style={{ maxWidth: 1440, padding: 24, display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 22 }}
      >
        <ProgressRail
          reportUnlocked={reportUnlocked}
          interviewStatus={interviewStatus}
          onOpenReportPaywall={() => setModal("report")}
          onOpenInterviewStart={() => setModal("interview")}
        />

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
      {modal === "interview" && (
        <InterviewStartModal
          roleTitle={roleTitle}
          onClose={() => setModal("none")}
          onStarted={() => {
            setInterviewStatus("invited");
            setModal("none");
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/hub/account/InterviewStartModal.tsx app/hub/account/DashboardClient.tsx
git commit -m "feat: add AI interview start modal, wire into dashboard"
```

---

### Task 10: `account/page.tsx` — fetch interview status

**Files:**
- Modify: `app/hub/account/page.tsx` (full-file replace)

**Interfaces:**
- Consumes: `fitment_interviews` table, `InterviewStatus` type from `./ProgressRail` (Task 8), `DashboardClient`'s new `initialInterviewStatus` prop (Task 9).
- No test — matches existing convention (this file has no test today).

- [ ] **Step 1: Replace the full file**

Replace the full contents of `d:\Work-Projects\merito-website-v2\app\hub\account\page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import DashboardClient from "./DashboardClient";
import type { InterviewStatus } from "./ProgressRail";
import { getResumeMatchReport, scoreOutOfTen, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import { getSupabaseServerClient } from "@/lib/supabase";

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
    .select("id, role_title, score, verdict, resume_match_status, resume_match_raw, ib_applied_job_id, created_at")
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

  let score = current.score;
  let verdict = current.verdict;
  let resumeMatchStatus = current.resume_match_status;
  let resumeMatchRaw = current.resume_match_raw;

  if (resumeMatchStatus === "PENDING") {
    try {
      const report = await getResumeMatchReport(current.ib_applied_job_id);
      if (report.status === "READY") {
        const freshRaw = {
          overallScore: report.overallScore,
          rank: report.rank,
          categories: report.categories,
          summary: report.summary,
          strongPoints: report.strongPoints,
          weakPoints: report.weakPoints,
        };
        const admin = getSupabaseServerClient();
        await admin
          .from("fitment_leads")
          .update({
            score: scoreOutOfTen(report.overallScore),
            verdict: report.summary,
            resume_match_status: "READY",
            resume_match_score: report.overallScore,
            resume_match_raw: freshRaw,
          })
          .eq("id", current.id);

        score = scoreOutOfTen(report.overallScore);
        verdict = report.summary;
        resumeMatchStatus = "READY";
        resumeMatchRaw = freshRaw;
      }
    } catch (err) {
      console.error("getResumeMatchReport failed on dashboard read, falling back to stale values", err);
    }
  }

  const report: ResumeMatchReportReady | null =
    reportUnlocked && resumeMatchStatus === "READY" && resumeMatchRaw
      ? (resumeMatchRaw as ResumeMatchReportReady)
      : null;

  const { data: interviewRow } = await supabase
    .from("fitment_interviews")
    .select("status")
    .eq("user_id", user.id)
    .eq("role_title", current.role_title)
    .maybeSingle();

  const interviewStatus: InterviewStatus = !interviewRow
    ? "not_started"
    : interviewRow.status === "ready"
      ? "ready"
      : "invited";

  return (
    <DashboardClient
      roleTitle={current.role_title}
      score={score}
      prevScore={prevForSameRole ? prevForSameRole.score : null}
      verdict={verdict}
      initialReportUnlocked={reportUnlocked}
      initialReport={report}
      initialInterviewStatus={interviewStatus}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/hub/account/page.tsx
git commit -m "feat: fetch AI interview status on the dashboard"
```

---

### Task 11: Interview report page

**Files:**
- Create: `app/hub/account/interview/InterviewSkillCard.tsx`
- Create: `app/hub/account/interview/page.tsx`

**Interfaces:**
- Consumes: `fitment_interviews.report_raw` (shape matches `InterviewReportReady` from Task 4, stored as plain JSON by Task 7).
- No tests — matches existing convention (`report/page.tsx`, `ResumeMatchCategoryCard.tsx` have no test files today).

- [ ] **Step 1: Create the skill card**

Create `d:\Work-Projects\merito-website-v2\app\hub\account\interview\InterviewSkillCard.tsx`:

```tsx
function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export default function InterviewSkillCard({ skill, score }: { skill: string; score: number }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.05rem", margin: 0 }}>
          {titleCase(skill)}
        </h3>
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13 }}>
          {score}/100
        </span>
      </div>
      <div className="bg-[#f0e6ea] overflow-hidden" style={{ height: 6, borderRadius: 6 }}>
        <div
          className="bg-[#ed1a24] h-full"
          style={{ borderRadius: 6, width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

Create `d:\Work-Projects\merito-website-v2\app\hub\account\interview\page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import InterviewSkillCard from "./InterviewSkillCard";

export default async function InterviewReportPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: interview } = await supabase
    .from("fitment_interviews")
    .select("role_title, status, report_raw")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!interview || interview.status !== "ready" || !interview.report_raw) {
    redirect("/hub/account");
  }

  const report = interview.report_raw as InterviewReportReady;

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
          Your AI interview report
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, margin: "0 0 24px" }}>
          {report.overallSkillScore}/100 overall for {interview.role_title}
        </p>

        <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, margin: "0 0 32px" }}>
          <p
            className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
            style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}
          >
            Overall assessment
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>
            {report.overallReport}
          </p>
        </div>

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "0 0 14px" }}>
          Skill breakdown
        </h2>
        {Object.entries(report.skillReport).map(([skill, score]) => (
          <InterviewSkillCard key={skill} skill={skill} score={score} />
        ))}

        {report.shareableReportLink && (
          <a
            href={report.shareableReportLink}
            target="_blank"
            rel="noreferrer"
            className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
            style={{ fontSize: 13, display: "inline-block", marginTop: 20 }}
          >
            View full report on IntervueBox →
          </a>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

Run: `npx vitest run`
Expected: All tests pass (Phase A/B's 51 plus this plan's new tests).

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/interview/InterviewSkillCard.tsx app/hub/account/interview/page.tsx
git commit -m "feat: add AI interview report page"
```

---

## After this plan ships

Register the webhook endpoint (`https://<domain>/api/webhooks/intervuebox`) in IntervueBox's dashboard (Settings → Webhooks) subscribed to at least `AIInterviewReportGenerated`, once a real account exists — this plan builds the receiver but can't register it without dashboard access. Set `INTERVUEBOX_WEBHOOK_SECRET` to match whatever secret is configured there.
