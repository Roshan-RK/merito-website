# IntervueBox Integration (Phase A + B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace both Claude-based fitment calls (`scoreFitment`, `generateFitmentReport`) with IntervueBox's real hiring-platform API — the landing free check now creates an IntervueBox job/resume/applicant and shows IntervueBox's resume-match score; the ₹299 report unlock now shows IntervueBox's full resume-match detail (six category scores, strengths, gaps) instead of Claude's category/action-plan breakdown.

**Architecture:** New `lib/intervuebox/` module (thin fetch client + one file per resource: jobs, resumes, applicants, reports) sits behind the existing two Route Handlers, which keep their existing request/response contracts with the frontend wherever possible. `fitment_leads` gets six new columns to track the IntervueBox chain (`ib_job_id` → `ib_resume_id` → `ib_applied_job_id` → resume-match status/score/raw) instead of a new table, since the resume-match result is now computed asynchronously and may not be ready at insert time. A new `GET /api/hub/fitment-check/status` endpoint lets the landing widget poll until IntervueBox's async score resolves.

**Tech Stack:** Next.js 16.2.4 App Router, `@supabase/supabase-js` 2.110.5 (service-role client, no ORM), Vitest 4.1.10 with hand-rolled `fetch`/Supabase-chain mocks (no `msw`, no test DB). No new npm dependencies — IntervueBox is called with native `fetch`, matching `lib/recaptcha.ts`.

## Global Constraints

- **Scope: Phase A (landing free check) + Phase B (report unlock) only.** Phase C (the real AI interview, its webhook, and the `interview` ProgressRail step) is explicitly out of scope for this plan — per the design doc's own build-sequencing note (`specs/2026-07-17-intervuebox-integration-design.md`, "Build sequencing implication"), the webhook payload body shape is undocumented and there is no sandbox key yet to verify against. It becomes a separate follow-up plan once IntervueBox supplies both.
- **API base URL and paths (confirmed live from `https://manavrittisolutionspvtltd.mintlify.app/api/*.md`, the IntervueBox docs, 2026-07-17):** base `https://api.intervuebox.ai/api/v1`, auth header `Authorization: Bearer <key>`. Endpoints used here: `POST /public/jobs`, `POST /public/resumes` (multipart), `POST /public/jobs/:jobId/applicants`, `GET /public/reports/applicants/:appliedJobId/resume-match`.
- **Error shape (confirmed live):** `{ "error": { "code": string, "message": string, "status": number, "details"?: object } }` — nested under an `error` key. `lib/intervuebox/client.ts` unwraps this into a typed `IntervueBoxError`.
- **Confirmed response ID field names (live docs):** `POST /public/jobs` → `jobId`; `POST /public/resumes` → `resumeId` (response shape `{ success, resumeId, message }`); `POST /public/jobs/:jobId/applicants` → `applicantId` (this is the same value later addressed as `:appliedJobId` in report/detail endpoints — confirmed by cross-referencing the resume-match report's example response, which echoes `"applicantId": "APJ_def456ghi"` at its top level).
- **Assumed (not directly confirmed live) request fields — carried over from the design doc's own earlier verbatim-docs research, since re-fetching today's docs summarized the create-job/add-applicant pages without full request-body listings:**
  - `POST /public/jobs` body: `title, location (string[]), jobType, industry, designation, openings (number), department, jobDescription`. Defaults for fields Merito's form doesn't collect: `location: ["Remote"]`, `jobType: "Full-time"`, `industry: "General"`, `designation: <role title>`, `department: "General"`, `openings: 1`.
  - `POST /public/jobs/:jobId/applicants` body requires `currentCtc, expectedCtc, willingToRelocate, hearAboutUs, noticePeriod, phoneNumber, name` (all free-text strings, no documented enum) plus `resumeId` and `email` to link the resume and identify the candidate. Placeholders for fields Merito doesn't collect: `currentCtc: "Not specified"`, `expectedCtc: "Not specified"`, `willingToRelocate: "Not specified"`, `hearAboutUs: "Merito HUB"`, `noticePeriod: "Not specified"`.
  - If the real API rejects any of these once a live key exists, adjust `lib/intervuebox/jobs.ts` / `lib/intervuebox/applicants.ts` request bodies — the response-side field names above (`jobId`, `resumeId`, `applicantId`) and the resume-match report shape below are the parts confirmed against live docs today and should not need to change.
- **Resume-match report shape (confirmed live, matches design doc's resolved item #4 exactly):** `GET /public/reports/applicants/:appliedJobId/resume-match` → `{ applicantId, candidateId, candidateName, status: "PENDING"|"READY", resumeMatch?: { skillsMatch: {score,comment}, educationMatch: {score,comment}, experienceMatch: {score,comment}, locationMatch: {score,comment}, domainMatch: {score,comment}, roleRelevance: {score,comment}, summary, strongPoints: string[], weakPoints: string[], overallScore: number (0–100), rank: number|null } }`.
- **Score conversion:** the UI's existing score display is 0–10 with one decimal; IntervueBox's `overallScore` is 0–100. Convert with `scoreOutOfTen(overallScore) = Math.round(overallScore) / 10` (in `lib/intervuebox/reports.ts`). The one-sentence "verdict" text the UI shows under the score becomes IntervueBox's `resumeMatch.summary` (a short paragraph, not one sentence — `FitmentChecker.tsx`/`ScoreCard.tsx` render it as plain body text today with no length constraint enforced in code, so this is a safe substitution, not a UI change).
- **Landing-widget polling constants are provisional:** poll `GET /api/hub/fitment-check/status?leadId=...` every 3000ms, stop after 20 attempts (60s total), then show a "still processing" message instead of a score. The design doc explicitly defers exact polling UX to a post-launch latency spike once a real key exists (§Landing wait UX) — these are safe, concrete defaults to ship Phase A now, not a placeholder; revisit once PENDING→READY latency is actually measured.
- **`fitment_reports` table is no longer written to by this plan.** Phase B now stores the resume-match detail directly on `fitment_leads.resume_match_raw` (Task 6) instead of a separate report row, because the same resume-match fetch now serves both the landing score and the unlocked detail. The `fitment_reports` table itself is left in place, unmodified — dropping it is a separate, later cleanup, out of scope here (matches the design doc's "extend rather than replace" approach).
- **`cv_text`, `lib/parseCvFile.ts`, `pdf-parse`, `mammoth`, `@anthropic-ai/sdk` are fully retired by this plan (Task 11).** Grepped across the repo — only used by the two Claude-based functions this plan replaces and their own tests. IntervueBox's Resumes API takes the raw uploaded file directly (multipart), so there's no reason to extract CV text anymore.
- **Migration numbering:** the most recently applied migration is `0005_fitment_reports_categories.sql`. A `0006_reference_checks.sql` is already referenced by a separate, not-yet-built sibling plan (`plans/2026-07-17-hub-reference-checks-plan.md`). This plan's migration is numbered `0007_intervuebox_resume_match.sql` to avoid a collision. If `0006` has not shipped by the time this plan is executed, renumber this migration to `0006` and confirm with whoever owns the reference-checks plan first.
- Env vars: `INTERVUEBOX_API_KEY`, `INTERVUEBOX_BASE_URL` — read directly via `process.env` inside `lib/intervuebox/client.ts`, throwing inline if missing. Matches this repo's existing convention (`lib/supabase.ts`, `lib/supabaseAuth.ts`) — there is no centralized `lib/env.ts` to hook into, and introducing one would be a departure from the current convention, not a continuation of it.
- Match existing code style: double quotes, semicolons, `lib/` flat-file convention (one exported concern per file), Tailwind arbitrary-value className strings mixed with inline `style={}` for any UI (see `ScoreCard.tsx`, `ProgressRail.tsx`).
- Test command: `npx vitest run <path>`. Vitest, not Jest — mock `fetch` with `vi.stubGlobal("fetch", fetchMock)`, mock Supabase chains by hand (see `app/api/hub/unlock-report/__tests__/route.test.ts` for the chain-mock pattern), reset with `vi.resetModules()` / `vi.unstubAllEnvs()` in `beforeEach`/`afterEach` exactly as the existing route tests do.
- Migrations in `supabase/migrations/` are never applied automatically by this plan or by CI — they're written here and applied once, by hand, in the Supabase SQL editor (same convention as every prior Hub migration).
- Never `git add -A`; stage explicitly.
- `specs/` and `plans/` at the repo root are the tracked locations for design docs and plans (confirmed via `.gitignore:54`, which ignores `docs/` — a misplaced copy of this plan's design doc was found under the gitignored `docs/superpowers/specs/` and has already been moved to `specs/2026-07-17-intervuebox-integration-design.md` as part of preparing this plan).

---

### Task 1: IntervueBox fetch client — `lib/intervuebox/client.ts`

**Files:**
- Create: `lib/intervuebox/client.ts`
- Test: `lib/intervuebox/__tests__/client.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `intervueBoxFetch<T>(path: string, init?: RequestInit): Promise<T>`, `class IntervueBoxError extends Error { code: string; status: number; details?: unknown }`.

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\__tests__\client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("intervueBoxFetch", () => {
  beforeEach(() => {
    vi.stubEnv("INTERVUEBOX_API_KEY", "sk_test_abc");
    vi.stubEnv("INTERVUEBOX_BASE_URL", "https://api.intervuebox.ai/api/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends a bearer token and returns the parsed JSON body on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, jobId: "JOB_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { intervueBoxFetch } = await import("../client");
    const result = await intervueBoxFetch<{ success: boolean; jobId: string }>("/public/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "PM" }),
    });

    expect(result).toEqual({ success: true, jobId: "JOB_123" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.intervuebox.ai/api/v1/public/jobs",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      })
    );
    const sentHeaders = fetchMock.mock.calls[0][1].headers as Headers;
    expect(sentHeaders.get("Authorization")).toBe("Bearer sk_test_abc");
  });

  it("throws a typed IntervueBoxError with the unwrapped error body on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: "invalid_request", message: "title is required", status: 400, details: { field: "title" } },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { intervueBoxFetch, IntervueBoxError } = await import("../client");
    await expect(intervueBoxFetch("/public/jobs", { method: "POST" })).rejects.toThrow(IntervueBoxError);

    try {
      await intervueBoxFetch("/public/jobs", { method: "POST" });
    } catch (err) {
      expect(err).toBeInstanceOf(IntervueBoxError);
      const ibErr = err as InstanceType<typeof IntervueBoxError>;
      expect(ibErr.code).toBe("invalid_request");
      expect(ibErr.status).toBe(400);
      expect(ibErr.details).toEqual({ field: "title" });
    }
  });

  it("throws a plain Error if INTERVUEBOX_API_KEY is missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("INTERVUEBOX_BASE_URL", "https://api.intervuebox.ai/api/v1");
    const { intervueBoxFetch } = await import("../client");
    await expect(intervueBoxFetch("/public/jobs")).rejects.toThrow(/INTERVUEBOX_API_KEY/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/intervuebox/__tests__/client.test.ts`
Expected: FAIL with "Cannot find module '../client'" (or similar — file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\client.ts`:

```ts
export type IntervueBoxErrorShape = {
  code: string;
  message: string;
  status: number;
  details?: unknown;
};

export class IntervueBoxError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(shape: IntervueBoxErrorShape) {
    super(shape.message);
    this.name = "IntervueBoxError";
    this.code = shape.code;
    this.status = shape.status;
    this.details = shape.details;
  }
}

function requireEnv(name: "INTERVUEBOX_API_KEY" | "INTERVUEBOX_BASE_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`IntervueBox is not configured (${name} missing).`);
  }
  return value;
}

export async function intervueBoxFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = requireEnv("INTERVUEBOX_API_KEY");
  const baseUrl = requireEnv("INTERVUEBOX_BASE_URL").replace(/\/$/, "");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, cache: "no-store" });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errorShape = (body as { error?: Partial<IntervueBoxErrorShape> } | null)?.error ?? {};
    throw new IntervueBoxError({
      code: errorShape.code ?? "unknown_error",
      message: errorShape.message ?? `IntervueBox request failed with status ${response.status}`,
      status: errorShape.status ?? response.status,
      details: errorShape.details,
    });
  }

  return body as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/intervuebox/__tests__/client.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add env vars**

In `d:\Work-Projects\merito-website-v2\.env.example`, add after the `SUPABASE_SERVICE_ROLE_KEY` line:

```
INTERVUEBOX_API_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
INTERVUEBOX_BASE_URL=https://api.intervuebox.ai/api/v1
```

- [ ] **Step 6: Commit**

```bash
git add lib/intervuebox/client.ts lib/intervuebox/__tests__/client.test.ts .env.example
git commit -m "feat: add IntervueBox fetch client"
```

---

### Task 2: `lib/intervuebox/jobs.ts`

**Files:**
- Create: `lib/intervuebox/jobs.ts`
- Test: `lib/intervuebox/__tests__/jobs.test.ts`

**Interfaces:**
- Consumes: `intervueBoxFetch<T>(path, init)` from `./client` (Task 1).
- Produces: `createJob(input: { title: string; jobDescription: string }): Promise<{ ibJobId: string }>`.

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\__tests__\jobs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("createJob", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("posts job defaults and returns the created job id", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, jobId: "JOB_123" });
    const { createJob } = await import("../jobs");

    const result = await createJob({ title: "Senior Product Manager", jobDescription: "Ship things." });

    expect(result).toEqual({ ibJobId: "JOB_123" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/jobs",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({
      title: "Senior Product Manager",
      location: ["Remote"],
      jobType: "Full-time",
      industry: "General",
      designation: "Senior Product Manager",
      department: "General",
      openings: 1,
      jobDescription: "Ship things.",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/intervuebox/__tests__/jobs.test.ts`
Expected: FAIL (module `../jobs` not found)

- [ ] **Step 3: Write the implementation**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\jobs.ts`:

```ts
import { intervueBoxFetch } from "./client";

export type CreateJobInput = {
  title: string;
  jobDescription: string;
};

type CreateJobResponse = {
  success: boolean;
  jobId: string;
};

export async function createJob(input: CreateJobInput): Promise<{ ibJobId: string }> {
  const response = await intervueBoxFetch<CreateJobResponse>("/public/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      location: ["Remote"],
      jobType: "Full-time",
      industry: "General",
      designation: input.title,
      department: "General",
      openings: 1,
      jobDescription: input.jobDescription,
    }),
  });
  return { ibJobId: response.jobId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/intervuebox/__tests__/jobs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/intervuebox/jobs.ts lib/intervuebox/__tests__/jobs.test.ts
git commit -m "feat: add IntervueBox createJob"
```

---

### Task 3: `lib/intervuebox/resumes.ts`

**Files:**
- Create: `lib/intervuebox/resumes.ts`
- Test: `lib/intervuebox/__tests__/resumes.test.ts`

**Interfaces:**
- Consumes: `intervueBoxFetch<T>(path, init)` from `./client` (Task 1).
- Produces: `uploadResume(file: File, params: { jobId: string }): Promise<{ ibResumeId: string }>`.

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\__tests__\resumes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("uploadResume", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("forwards the raw file as multipart form data with the job id and returns the resume id", async () => {
    intervueBoxFetchMock.mockResolvedValue({ success: true, resumeId: "RES_123", message: "ok" });
    const { uploadResume } = await import("../resumes");
    const file = new File([new Uint8Array([1, 2, 3])], "resume.pdf", { type: "application/pdf" });

    const result = await uploadResume(file, { jobId: "JOB_123" });

    expect(result).toEqual({ ibResumeId: "RES_123" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/resumes",
      expect.objectContaining({ method: "POST" })
    );
    const sentForm = intervueBoxFetchMock.mock.calls[0][1].body as FormData;
    expect(sentForm.get("file")).toBe(file);
    expect(sentForm.get("jobId")).toBe("JOB_123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/intervuebox/__tests__/resumes.test.ts`
Expected: FAIL (module `../resumes` not found)

- [ ] **Step 3: Write the implementation**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\resumes.ts`:

```ts
import { intervueBoxFetch } from "./client";

type UploadResumeResponse = {
  success: boolean;
  resumeId: string;
  message: string;
};

export async function uploadResume(file: File, params: { jobId: string }): Promise<{ ibResumeId: string }> {
  const form = new FormData();
  form.set("file", file);
  form.set("jobId", params.jobId);

  const response = await intervueBoxFetch<UploadResumeResponse>("/public/resumes", {
    method: "POST",
    body: form,
  });
  return { ibResumeId: response.resumeId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/intervuebox/__tests__/resumes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/intervuebox/resumes.ts lib/intervuebox/__tests__/resumes.test.ts
git commit -m "feat: add IntervueBox uploadResume"
```

---

### Task 4: `lib/intervuebox/applicants.ts`

**Files:**
- Create: `lib/intervuebox/applicants.ts`
- Test: `lib/intervuebox/__tests__/applicants.test.ts`

**Interfaces:**
- Consumes: `intervueBoxFetch<T>(path, init)` from `./client` (Task 1).
- Produces: `addApplicant(input: AddApplicantInput): Promise<{ ibAppliedJobId: string }>` where `AddApplicantInput = { jobId: string; resumeId: string; name: string; email: string; phoneNumber: string }`.

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\__tests__\applicants.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("addApplicant", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("posts required applicant fields with Merito's placeholder defaults and returns the applicant id", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      applicantId: "APJ_123",
      jobId: "JOB_123",
      candidateId: "USR_123",
      createdAt: "2026-07-17T00:00:00Z",
    });
    const { addApplicant } = await import("../applicants");

    const result = await addApplicant({
      jobId: "JOB_123",
      resumeId: "RES_123",
      name: "Jane Doe",
      email: "jane@example.com",
      phoneNumber: "+919876543210",
    });

    expect(result).toEqual({ ibAppliedJobId: "APJ_123" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/jobs/JOB_123/applicants",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({
      resumeId: "RES_123",
      name: "Jane Doe",
      email: "jane@example.com",
      phoneNumber: "+919876543210",
      currentCtc: "Not specified",
      expectedCtc: "Not specified",
      willingToRelocate: "Not specified",
      hearAboutUs: "Merito HUB",
      noticePeriod: "Not specified",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/intervuebox/__tests__/applicants.test.ts`
Expected: FAIL (module `../applicants` not found)

- [ ] **Step 3: Write the implementation**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\applicants.ts`:

```ts
import { intervueBoxFetch } from "./client";

export type AddApplicantInput = {
  jobId: string;
  resumeId: string;
  name: string;
  email: string;
  phoneNumber: string;
};

type AddApplicantResponse = {
  applicantId: string;
  jobId: string;
  candidateId: string;
  createdAt: string;
};

export async function addApplicant(input: AddApplicantInput): Promise<{ ibAppliedJobId: string }> {
  const response = await intervueBoxFetch<AddApplicantResponse>(`/public/jobs/${input.jobId}/applicants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resumeId: input.resumeId,
      name: input.name,
      email: input.email,
      phoneNumber: input.phoneNumber,
      currentCtc: "Not specified",
      expectedCtc: "Not specified",
      willingToRelocate: "Not specified",
      hearAboutUs: "Merito HUB",
      noticePeriod: "Not specified",
    }),
  });
  return { ibAppliedJobId: response.applicantId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/intervuebox/__tests__/applicants.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/intervuebox/applicants.ts lib/intervuebox/__tests__/applicants.test.ts
git commit -m "feat: add IntervueBox addApplicant"
```

---

### Task 5: `lib/intervuebox/reports.ts`

**Files:**
- Create: `lib/intervuebox/reports.ts`
- Test: `lib/intervuebox/__tests__/reports.test.ts`

**Interfaces:**
- Consumes: `intervueBoxFetch<T>(path, init)` from `./client` (Task 1).
- Produces:
  - `type ResumeMatchCategoryKey = "skillsMatch" | "educationMatch" | "experienceMatch" | "locationMatch" | "domainMatch" | "roleRelevance"`
  - `type ResumeMatchCategory = { key: ResumeMatchCategoryKey; label: string; score: number; comment: string }`
  - `type ResumeMatchReportReady = { overallScore: number; rank: number | null; categories: ResumeMatchCategory[]; summary: string; strongPoints: string[]; weakPoints: string[] }`
  - `type ResumeMatchReport = { status: "PENDING" } | ({ status: "READY" } & ResumeMatchReportReady)`
  - `getResumeMatchReport(appliedJobId: string): Promise<ResumeMatchReport>`
  - `scoreOutOfTen(overallScore: number): number`
  - These types are consumed later by Tasks 7, 8, 9, 10.

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\__tests__\reports.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("getResumeMatchReport", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("returns PENDING when the report isn't ready yet", async () => {
    intervueBoxFetchMock.mockResolvedValue({ applicantId: "APJ_123", status: "PENDING" });
    const { getResumeMatchReport } = await import("../reports");

    const result = await getResumeMatchReport("APJ_123");

    expect(result).toEqual({ status: "PENDING" });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith("/public/reports/applicants/APJ_123/resume-match");
  });

  it("maps the READY resumeMatch payload into the six labeled categories", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      applicantId: "APJ_123",
      status: "READY",
      resumeMatch: {
        skillsMatch: { score: 85, comment: "Strong match on core skills" },
        educationMatch: { score: 90, comment: "Meets education requirement" },
        experienceMatch: { score: 78, comment: "5 years vs 5+ required" },
        locationMatch: { score: 100, comment: "Same location" },
        domainMatch: { score: 80, comment: "Relevant domain experience" },
        roleRelevance: { score: 82, comment: "Closely aligned to the role" },
        summary: "Overall a strong fit for the role.",
        strongPoints: ["5+ years in backend engineering"],
        weakPoints: ["No direct experience with Kubernetes"],
        overallScore: 82,
        rank: 1,
      },
    });
    const { getResumeMatchReport } = await import("../reports");

    const result = await getResumeMatchReport("APJ_123");

    expect(result).toEqual({
      status: "READY",
      overallScore: 82,
      rank: 1,
      summary: "Overall a strong fit for the role.",
      strongPoints: ["5+ years in backend engineering"],
      weakPoints: ["No direct experience with Kubernetes"],
      categories: [
        { key: "skillsMatch", label: "Skills Match", score: 85, comment: "Strong match on core skills" },
        { key: "educationMatch", label: "Education Match", score: 90, comment: "Meets education requirement" },
        { key: "experienceMatch", label: "Experience Match", score: 78, comment: "5 years vs 5+ required" },
        { key: "locationMatch", label: "Location Match", score: 100, comment: "Same location" },
        { key: "domainMatch", label: "Domain Match", score: 80, comment: "Relevant domain experience" },
        { key: "roleRelevance", label: "Role Relevance", score: 82, comment: "Closely aligned to the role" },
      ],
    });
  });
});

describe("scoreOutOfTen", () => {
  it("converts a 0-100 score to a 0-10 score with one decimal", async () => {
    const { scoreOutOfTen } = await import("../reports");
    expect(scoreOutOfTen(82)).toBe(8.2);
    expect(scoreOutOfTen(78.4)).toBe(7.8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/intervuebox/__tests__/reports.test.ts`
Expected: FAIL (module `../reports` not found)

- [ ] **Step 3: Write the implementation**

Create `d:\Work-Projects\merito-website-v2\lib\intervuebox\reports.ts`:

```ts
import { intervueBoxFetch } from "./client";

export type ResumeMatchCategoryKey =
  | "skillsMatch"
  | "educationMatch"
  | "experienceMatch"
  | "locationMatch"
  | "domainMatch"
  | "roleRelevance";

export type ResumeMatchCategory = {
  key: ResumeMatchCategoryKey;
  label: string;
  score: number;
  comment: string;
};

export type ResumeMatchReportReady = {
  overallScore: number;
  rank: number | null;
  categories: ResumeMatchCategory[];
  summary: string;
  strongPoints: string[];
  weakPoints: string[];
};

export type ResumeMatchReport = { status: "PENDING" } | ({ status: "READY" } & ResumeMatchReportReady);

const CATEGORY_LABELS: Record<ResumeMatchCategoryKey, string> = {
  skillsMatch: "Skills Match",
  educationMatch: "Education Match",
  experienceMatch: "Experience Match",
  locationMatch: "Location Match",
  domainMatch: "Domain Match",
  roleRelevance: "Role Relevance",
};

const CATEGORY_KEYS: ResumeMatchCategoryKey[] = [
  "skillsMatch",
  "educationMatch",
  "experienceMatch",
  "locationMatch",
  "domainMatch",
  "roleRelevance",
];

type RawResumeMatch = {
  overallScore: number;
  rank: number | null;
  summary: string;
  strongPoints: string[];
  weakPoints: string[];
} & Record<ResumeMatchCategoryKey, { score: number; comment: string }>;

type RawResumeMatchResponse = {
  applicantId: string;
  status: "PENDING" | "READY";
  resumeMatch?: RawResumeMatch;
};

export async function getResumeMatchReport(appliedJobId: string): Promise<ResumeMatchReport> {
  const response = await intervueBoxFetch<RawResumeMatchResponse>(
    `/public/reports/applicants/${appliedJobId}/resume-match`
  );

  if (response.status !== "READY" || !response.resumeMatch) {
    return { status: "PENDING" };
  }

  const match = response.resumeMatch;
  return {
    status: "READY",
    overallScore: match.overallScore,
    rank: match.rank,
    summary: match.summary,
    strongPoints: match.strongPoints,
    weakPoints: match.weakPoints,
    categories: CATEGORY_KEYS.map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      score: match[key].score,
      comment: match[key].comment,
    })),
  };
}

export function scoreOutOfTen(overallScore: number): number {
  return Math.round(overallScore * 10) / 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/intervuebox/__tests__/reports.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/intervuebox/reports.ts lib/intervuebox/__tests__/reports.test.ts
git commit -m "feat: add IntervueBox resume-match report client"
```

---

### Task 6: Database migration — add IntervueBox columns to `fitment_leads`

**Files:**
- Create: `supabase/migrations/0007_intervuebox_resume_match.sql`

**Interfaces:**
- Produces: `fitment_leads` columns `ib_job_id text`, `ib_resume_id text`, `ib_applied_job_id text`, `resume_match_status text`, `resume_match_score numeric`, `resume_match_raw jsonb` — consumed by Tasks 7 and 9.

- [ ] **Step 1: Write the migration**

Create `d:\Work-Projects\merito-website-v2\supabase\migrations\0007_intervuebox_resume_match.sql`:

```sql
alter table fitment_leads
  add column if not exists ib_job_id text,
  add column if not exists ib_resume_id text,
  add column if not exists ib_applied_job_id text,
  add column if not exists resume_match_status text check (resume_match_status in ('PENDING', 'READY')),
  add column if not exists resume_match_score numeric check (resume_match_score is null or (resume_match_score >= 0 and resume_match_score <= 100)),
  add column if not exists resume_match_raw jsonb;
```

- [ ] **Step 2: Apply by hand in the Supabase SQL editor**

This migration is not applied by this plan or by CI (matches existing convention). Note in the task tracker that `0007_intervuebox_resume_match.sql` needs to be run in the Supabase SQL editor before Task 7's route changes can be exercised against a real database — until then, route tests (which mock Supabase entirely) still pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_intervuebox_resume_match.sql
git commit -m "feat: add IntervueBox resume-match columns to fitment_leads"
```

---

### Task 7: Rewrite `fitment-check` route + new `status` polling route

**Files:**
- Modify: `app/api/hub/fitment-check/route.ts`
- Modify: `app/api/hub/fitment-check/__tests__/route.test.ts`
- Create: `app/api/hub/fitment-check/status/route.ts`
- Create: `app/api/hub/fitment-check/status/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `createJob` (Task 2), `uploadResume` (Task 3), `addApplicant` (Task 4), `getResumeMatchReport`/`scoreOutOfTen` (Task 5), `fitment_leads` columns from Task 6.
- Produces: `POST /api/hub/fitment-check` now responds `{ status: "pending", leadId: string }` or `{ status: "ready", score: number, verdict: string }` (previously always `{ score, verdict }` — Task 8 updates the frontend to match). `GET /api/hub/fitment-check/status?leadId=...` responds `{ status: "pending" }` or `{ status: "ready", score: number, verdict: string }`.

- [ ] **Step 1: Rewrite the fitment-check route test**

Replace the full contents of `d:\Work-Projects\merito-website-v2\app\api\hub\fitment-check\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/recaptcha", () => ({
  verifyRecaptchaToken: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/intervuebox/jobs", () => ({
  createJob: vi.fn().mockResolvedValue({ ibJobId: "JOB_123" }),
}));
vi.mock("@/lib/intervuebox/resumes", () => ({
  uploadResume: vi.fn().mockResolvedValue({ ibResumeId: "RES_123" }),
}));
vi.mock("@/lib/intervuebox/applicants", () => ({
  addApplicant: vi.fn().mockResolvedValue({ ibAppliedJobId: "APJ_123" }),
}));
vi.mock("@/lib/intervuebox/reports", () => ({
  getResumeMatchReport: vi.fn().mockResolvedValue({
    status: "READY",
    overallScore: 78,
    rank: 1,
    categories: [],
    summary: "Good fit.",
    strongPoints: [],
    weakPoints: [],
  }),
  scoreOutOfTen: (overallScore: number) => Math.round(overallScore * 10) / 100,
}));

const insertSelectSingleMock = vi.fn().mockResolvedValue({ data: { id: "lead-1" }, error: null });
const insertSelectMock = vi.fn().mockReturnValue({ single: insertSelectSingleMock });
const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

async function importRoute() {
  return await import("../route");
}

function buildForm(overrides: Record<string, string | Blob> = {}) {
  const form = new FormData();
  form.set("name", "Jane Doe");
  form.set("email", "candidate@example.com");
  form.set("role", "Senior Product Manager");
  form.set("jdText", "We need a PM who can ship.");
  form.set("phone", "+919876543210");
  form.set("recaptchaToken", "token-123");
  form.set("cv", new Blob(["cv bytes"], { type: "application/pdf" }), "resume.pdf");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

describe("POST /api/hub/fitment-check", () => {
  beforeEach(() => {
    insertMock.mockClear();
    insertSelectMock.mockClear();
    insertSelectSingleMock.mockClear();
    insertSelectSingleMock.mockResolvedValue({ data: { id: "lead-1" }, error: null });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 ready with the score when the resume-match report resolves inline", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ready", score: 7.8, verdict: "Good fit." });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ib_job_id: "JOB_123",
        ib_resume_id: "RES_123",
        ib_applied_job_id: "APJ_123",
        resume_match_status: "READY",
      })
    );
  });

  it("returns 200 pending with a leadId when the resume-match report isn't ready yet", async () => {
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockResolvedValueOnce({ status: "PENDING" });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "pending", leadId: "lead-1" });
  });

  it("rejects a submission with no email", async () => {
    const form = buildForm();
    form.delete("email");
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: form,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a submission with no phone number", async () => {
    const form = buildForm();
    form.delete("phone");
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: form,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a submission that fails reCAPTCHA", async () => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "test-secret");
    const { verifyRecaptchaToken } = await import("@/lib/recaptcha");
    vi.mocked(verifyRecaptchaToken).mockResolvedValueOnce(false);
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a CV file larger than 5MB", async () => {
    const bigFile = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "application/pdf" });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm({ cv: bigFile }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/too large/i);
  });

  it("rejects requests once the per-IP rate limit is exceeded, even with different emails", async () => {
    const { POST } = await importRoute();
    const headers = { "x-forwarded-for": "203.0.113.5" };

    let lastResponse: Response | undefined;
    for (let i = 0; i < 6; i++) {
      const request = new Request("http://localhost/api/hub/fitment-check", {
        method: "POST",
        headers,
        body: buildForm({ email: `candidate${i}@example.com` }),
      });
      lastResponse = await POST(request);
    }

    expect(lastResponse?.status).toBe(429);
  });

  it("returns 500 if any IntervueBox call in the chain fails", async () => {
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockRejectedValueOnce(new Error("boom"));
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/hub/fitment-check/__tests__/route.test.ts`
Expected: FAIL (route still imports `@/lib/scoreFitment`, doesn't match new response shape)

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `d:\Work-Projects\merito-website-v2\app\api\hub\fitment-check\route.ts`:

```ts
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { createRateLimiter } from "@/lib/rateLimit";
import { createJob } from "@/lib/intervuebox/jobs";
import { uploadResume } from "@/lib/intervuebox/resumes";
import { addApplicant } from "@/lib/intervuebox/applicants";
import { getResumeMatchReport, scoreOutOfTen } from "@/lib/intervuebox/reports";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

const checkEmailRateLimit = createRateLimiter({ max: 3, windowMs: 60 * 60 * 1000 });
const checkIpRateLimit = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, matches client-side cap in FitmentChecker.tsx
const MAX_TEXT_CHARS = 20000;

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = normalize(form.get("name"));
  const email = normalize(form.get("email"));
  const role = normalize(form.get("role"));
  const jdText = normalize(form.get("jdText"));
  const jdUrl = normalize(form.get("jdUrl"));
  const phone = normalize(form.get("phone"));
  const recaptchaToken = normalize(form.get("recaptchaToken"));
  const cv = form.get("cv");

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!role) {
    return Response.json({ error: "Target role is required." }, { status: 400 });
  }
  if (!phone) {
    return Response.json({ error: "A phone number is required." }, { status: 400 });
  }
  if (!jdText && !jdUrl) {
    return Response.json({ error: "Paste a job description or provide a link." }, { status: 400 });
  }
  if (!(cv instanceof File) || cv.size === 0) {
    return Response.json({ error: "A CV file is required." }, { status: 400 });
  }
  if (cv.size > MAX_CV_SIZE_BYTES) {
    return Response.json(
      { error: "CV file is too large — please upload a file under 5MB." },
      { status: 400 }
    );
  }

  const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (recaptchaSecretKey) {
    if (!recaptchaToken) {
      return Response.json({ error: "Captcha verification is required." }, { status: 400 });
    }
    const isHuman = await verifyRecaptchaToken(recaptchaToken, recaptchaSecretKey);
    if (!isHuman) {
      return Response.json({ error: "Captcha verification failed." }, { status: 400 });
    }
  }

  if (!checkEmailRateLimit(email) || !checkIpRateLimit(ip)) {
    return Response.json(
      { error: "You've checked your fitment recently — please try again later." },
      { status: 429 }
    );
  }

  const jdSource = jdText ? "paste" : "link";
  const jdForScoring = (jdText || jdUrl).slice(0, MAX_TEXT_CHARS);

  let ibJobId: string;
  let ibResumeId: string;
  let ibAppliedJobId: string;
  try {
    ({ ibJobId } = await createJob({ title: role, jobDescription: jdForScoring }));
    ({ ibResumeId } = await uploadResume(cv, { jobId: ibJobId }));
    ({ ibAppliedJobId } = await addApplicant({
      jobId: ibJobId,
      resumeId: ibResumeId,
      name: name || "Candidate",
      email,
      phoneNumber: phone,
    }));
  } catch {
    return Response.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }

  const report = await getResumeMatchReport(ibAppliedJobId).catch(() => ({ status: "PENDING" as const }));

  const supabase = getSupabaseServerClient();
  const { data: inserted, error: insertError } = await supabase
    .from("fitment_leads")
    .insert({
      name: name || null,
      email,
      role_title: role,
      jd_text: jdForScoring,
      jd_source: jdSource,
      score: report.status === "READY" ? scoreOutOfTen(report.overallScore) : 0,
      verdict: report.status === "READY" ? report.summary : "",
      ib_job_id: ibJobId,
      ib_resume_id: ibResumeId,
      ib_applied_job_id: ibAppliedJobId,
      resume_match_status: report.status,
      resume_match_score: report.status === "READY" ? report.overallScore : null,
      resume_match_raw:
        report.status === "READY"
          ? {
              overallScore: report.overallScore,
              rank: report.rank,
              categories: report.categories,
              summary: report.summary,
              strongPoints: report.strongPoints,
              weakPoints: report.weakPoints,
            }
          : null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return Response.json({ error: "Something went wrong saving your result." }, { status: 500 });
  }

  if (report.status === "PENDING") {
    return Response.json({ status: "pending", leadId: inserted.id });
  }

  return Response.json({ status: "ready", score: scoreOutOfTen(report.overallScore), verdict: report.summary });
}
```

- [ ] **Step 4: Run the fitment-check route test to verify it passes**

Run: `npx vitest run app/api/hub/fitment-check/__tests__/route.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Write the failing test for the new status route**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\fitment-check\status\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getResumeMatchReportMock = vi.fn();
vi.mock("@/lib/intervuebox/reports", () => ({
  getResumeMatchReport: getResumeMatchReportMock,
  scoreOutOfTen: (overallScore: number) => Math.round(overallScore * 10) / 100,
}));

const maybeSingleMock = vi.fn();
const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
const fromMock = vi.fn().mockReturnValue({ select: selectMock, update: updateMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importRoute() {
  return await import("../route");
}

describe("GET /api/hub/fitment-check/status", () => {
  beforeEach(() => {
    getResumeMatchReportMock.mockReset();
    maybeSingleMock.mockReset();
    updateEqMock.mockClear();
    updateEqMock.mockResolvedValue({ error: null });
  });

  it("returns 400 when leadId is missing", async () => {
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/fitment-check/status"));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the lead doesn't exist", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/fitment-check/status?leadId=lead-1"));
    expect(response.status).toBe(404);
  });

  it("returns the stored score directly when the lead is already READY", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { ib_applied_job_id: "APJ_1", resume_match_status: "READY", score: 7.8, verdict: "Good fit." },
      error: null,
    });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/fitment-check/status?leadId=lead-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", score: 7.8, verdict: "Good fit." });
    expect(getResumeMatchReportMock).not.toHaveBeenCalled();
  });

  it("re-fetches and returns pending when still not ready", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", score: 0, verdict: "" },
      error: null,
    });
    getResumeMatchReportMock.mockResolvedValue({ status: "PENDING" });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/fitment-check/status?leadId=lead-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "pending" });
  });

  it("re-fetches, updates the row, and returns ready once resolved", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", score: 0, verdict: "" },
      error: null,
    });
    getResumeMatchReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 78,
      rank: 2,
      categories: [],
      summary: "Good fit.",
      strongPoints: [],
      weakPoints: [],
    });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/fitment-check/status?leadId=lead-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", score: 7.8, verdict: "Good fit." });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ score: 7.8, verdict: "Good fit.", resume_match_status: "READY" })
    );
    expect(updateEqMock).toHaveBeenCalledWith("id", "lead-1");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run app/api/hub/fitment-check/status/__tests__/route.test.ts`
Expected: FAIL (module `../route` not found)

- [ ] **Step 7: Write the status route**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\fitment-check\status\route.ts`:

```ts
import { getSupabaseServerClient } from "@/lib/supabase";
import { getResumeMatchReport, scoreOutOfTen } from "@/lib/intervuebox/reports";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");
  if (!leadId) {
    return Response.json({ error: "leadId is required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("ib_applied_job_id, resume_match_status, score, verdict")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ error: "Fitment check not found." }, { status: 404 });
  }

  if (lead.resume_match_status === "READY") {
    return Response.json({ status: "ready", score: lead.score, verdict: lead.verdict });
  }

  const report = await getResumeMatchReport(lead.ib_applied_job_id).catch(() => ({ status: "PENDING" as const }));

  if (report.status === "PENDING") {
    return Response.json({ status: "pending" });
  }

  const score = scoreOutOfTen(report.overallScore);
  const { error: updateError } = await supabase
    .from("fitment_leads")
    .update({
      score,
      verdict: report.summary,
      resume_match_status: "READY",
      resume_match_score: report.overallScore,
      resume_match_raw: {
        overallScore: report.overallScore,
        rank: report.rank,
        categories: report.categories,
        summary: report.summary,
        strongPoints: report.strongPoints,
        weakPoints: report.weakPoints,
      },
    })
    .eq("id", leadId);

  if (updateError) {
    return Response.json({ error: "Something went wrong updating your result." }, { status: 500 });
  }

  return Response.json({ status: "ready", score, verdict: report.summary });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run app/api/hub/fitment-check/status/__tests__/route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Commit**

```bash
git add app/api/hub/fitment-check/route.ts app/api/hub/fitment-check/__tests__/route.test.ts app/api/hub/fitment-check/status/route.ts app/api/hub/fitment-check/status/__tests__/route.test.ts
git commit -m "feat: wire fitment-check landing flow to IntervueBox"
```

---

### Task 8: Update `FitmentChecker.tsx` — phone field + pending-status polling

**Files:**
- Modify: `app/hub/FitmentChecker.tsx`

**Interfaces:**
- Consumes: `POST /api/hub/fitment-check` (Task 7) response `{ status: "pending", leadId } | { status: "ready", score, verdict }`; `GET /api/hub/fitment-check/status?leadId=...` (Task 7) response `{ status: "pending" } | { status: "ready", score, verdict }`.

No automated test exists for this component (no component/browser test infra in this repo, confirmed by the existing route-test-only pattern across the codebase) — verify manually per Step 3.

- [ ] **Step 1: Add phone state and the phone input field**

In `d:\Work-Projects\merito-website-v2\app\hub\FitmentChecker.tsx`, add phone state next to `role` (after line 24, `const [role, setRole] = useState("");`):

```tsx
  const [phone, setPhone] = useState("");
```

Update `canSubmit` (line 62) to require phone:

```tsx
  const canSubmit = email.trim() && role.trim() && phone.trim() && (jdMode === "paste" ? jdText.trim() : jdUrl.trim()) && cvFile && !checking;
```

Add the phone input directly after the "Your email" input block (after the closing `/>` that follows line 172, before the "The role you want" label at line 174):

```tsx
      <label className="block font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12, marginBottom: 6 }}>
        Phone number
      </label>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+91 98765 43210"
        className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
        style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
      />
```

Add `form.set("phone", phone.trim());` to the `FormData` build in `checkFit`, right after `form.set("role", role.trim());` (line 95):

```tsx
    form.set("phone", phone.trim());
```

- [ ] **Step 2: Handle the pending/ready response shape and add polling**

Replace the `checkFit` function's try block (originally lines 101-118) with:

```tsx
    try {
      const res = await fetch("/api/hub/fitment-check", { method: "POST", body: form });
      const data = (await res.json()) as {
        status?: "pending" | "ready";
        score?: number;
        verdict?: string;
        leadId?: string;
        error?: string;
      };
      window.grecaptcha?.reset?.(widgetIdRef.current ?? undefined);
      if (!res.ok || !data.status) {
        setChecking(false);
        setErrorMsg(data.error || "Something went wrong — please try again.");
        return;
      }
      if (data.status === "ready" && typeof data.score === "number") {
        setChecking(false);
        setScore(data.score);
        setVerdict(data.verdict || "");
        animateScore(data.score);
        return;
      }
      if (data.status === "pending" && data.leadId) {
        pollForResult(data.leadId);
        return;
      }
      setChecking(false);
      setErrorMsg("Something went wrong — please try again.");
    } catch {
      window.grecaptcha?.reset?.(widgetIdRef.current ?? undefined);
      setChecking(false);
      setErrorMsg("Something went wrong — please try again.");
    }
  };

  const POLL_INTERVAL_MS = 3000;
  const POLL_MAX_ATTEMPTS = 20; // 20 * 3000ms = 60s, see plan's Global Constraints on provisional polling values

  const pollForResult = (leadId: string, attempt = 0) => {
    if (attempt >= POLL_MAX_ATTEMPTS) {
      setChecking(false);
      setErrorMsg("Your score is taking longer than usual — check back in a few minutes.");
      return;
    }
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/hub/fitment-check/status?leadId=${encodeURIComponent(leadId)}`);
        const data = (await res.json()) as { status?: "pending" | "ready"; score?: number; verdict?: string };
        if (res.ok && data.status === "ready" && typeof data.score === "number") {
          setChecking(false);
          setScore(data.score);
          setVerdict(data.verdict || "");
          animateScore(data.score);
          return;
        }
        pollForResult(leadId, attempt + 1);
      } catch {
        pollForResult(leadId, attempt + 1);
      }
    }, POLL_INTERVAL_MS);
  };
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, open `/hub` (or wherever `FitmentChecker` is rendered), submit the form without a phone number and confirm the button stays disabled / an error shows; submit with all fields filled — since `INTERVUEBOX_API_KEY` isn't configured yet in local `.env`, expect a 500 "Something went wrong" (from the `createJob` call throwing) rather than a hang, confirming the request pipeline runs end-to-end up to the IntervueBox call.

- [ ] **Step 4: Commit**

```bash
git add app/hub/FitmentChecker.tsx
git commit -m "feat: add phone field and pending-status polling to FitmentChecker"
```

---

### Task 9: Rewrite `unlock-report` route

**Files:**
- Modify: `app/api/hub/unlock-report/route.ts`
- Modify: `app/api/hub/unlock-report/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getResumeMatchReport`/`scoreOutOfTen`/`ResumeMatchReportReady` (Task 5), `unlockReport` (existing, unchanged), `fitment_leads` columns from Task 6.
- Produces: `POST /api/hub/unlock-report` now responds `{ status: "unlocked", report: ResumeMatchReportReady }` or `{ status: "pending" }` (previously `{ status: "unlocked", report: FitmentReportResult }` or `{ status: "needs_cv" }` — Task 10 updates the frontend consumers to match).

- [ ] **Step 1: Rewrite the route test**

Replace the full contents of `d:\Work-Projects\merito-website-v2\app\api\hub\unlock-report\__tests__\route.test.ts`:

```ts
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
const getResumeMatchReportMock = vi.fn();

const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
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
vi.mock("@/lib/intervuebox/reports", () => ({
  getResumeMatchReport: getResumeMatchReportMock,
  scoreOutOfTen: (overallScore: number) => Math.round(overallScore * 10) / 100,
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
    getResumeMatchReportMock.mockReset();
    updateMock.mockClear();
    updateEqMock.mockClear();
    updateEqMock.mockResolvedValue({ error: null });
    adminFromMock.mockReset();
    adminFromMock.mockReturnValue({ update: updateMock });
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

  it("returns the stored resume-match detail directly when already READY", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    const storedRaw = { overallScore: 78, rank: 1, categories: [], summary: "Good fit.", strongPoints: [], weakPoints: [] };
    buildLeadChain({
      data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "READY", resume_match_raw: storedRaw },
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
    expect(getResumeMatchReportMock).not.toHaveBeenCalled();
    expect(body).toEqual({ status: "unlocked", report: storedRaw });
  });

  it("re-fetches, updates the row, and unlocks when the stored status was still PENDING", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({
      data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", resume_match_raw: null },
      error: null,
    });
    unlockReportMock.mockResolvedValue(undefined);
    getResumeMatchReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 82,
      rank: 1,
      categories: [],
      summary: "Strong overall fit.",
      strongPoints: ["Skill A"],
      weakPoints: ["Gap A"],
    });

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(adminFromMock).toHaveBeenCalledWith("fitment_leads");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ score: 8.2, verdict: "Strong overall fit.", resume_match_status: "READY" })
    );
    expect(updateEqMock).toHaveBeenCalledWith("id", "lead-1");
    expect(body.status).toBe("unlocked");
    expect(body.report.summary).toBe("Strong overall fit.");
  });

  it("returns pending when re-fetch is still not ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    buildLeadChain({
      data: { id: "lead-1", ib_applied_job_id: "APJ_1", resume_match_status: "PENDING", resume_match_raw: null },
      error: null,
    });
    unlockReportMock.mockResolvedValue(undefined);
    getResumeMatchReportMock.mockResolvedValue({ status: "PENDING" });

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/unlock-report", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Senior Product Manager" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "pending" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/hub/unlock-report/__tests__/route.test.ts`
Expected: FAIL (route still imports `@/lib/generateFitmentReport`, doesn't match new response shape)

- [ ] **Step 3: Rewrite the route**

Replace the full contents of `d:\Work-Projects\merito-website-v2\app\api\hub\unlock-report\route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { unlockReport } from "@/lib/reportUnlocks";
import { getResumeMatchReport, scoreOutOfTen } from "@/lib/intervuebox/reports";
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
    .select("id, ib_applied_job_id, resume_match_status, resume_match_raw")
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/hub/unlock-report/__tests__/route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/unlock-report/route.ts app/api/hub/unlock-report/__tests__/route.test.ts
git commit -m "feat: wire unlock-report to IntervueBox resume-match detail"
```

---

### Task 10: Rewire report-rendering frontend to the new resume-match shape

**Files:**
- Modify: `app/hub/account/page.tsx`
- Modify: `app/hub/account/DashboardClient.tsx`
- Modify: `app/hub/account/ScoreCard.tsx`
- Modify: `app/hub/account/ReportPaywallModal.tsx`
- Modify: `app/hub/account/report/page.tsx`
- Create: `app/hub/account/report/ResumeMatchCategoryCard.tsx`
- Delete: `app/hub/account/report/CategorySection.tsx`
- Delete: `app/hub/account/report/RequirementRow.tsx`
- Delete: `app/hub/account/report/ActionPlanItem.tsx`

**Interfaces:**
- Consumes: `ResumeMatchReportReady`, `ResumeMatchCategory` (Task 5); `POST /api/hub/unlock-report` response shape from Task 9.

- [ ] **Step 1: Create the new category card component**

Create `d:\Work-Projects\merito-website-v2\app\hub\account\report\ResumeMatchCategoryCard.tsx`:

```tsx
import type { ResumeMatchCategory } from "@/lib/intervuebox/reports";

export default function ResumeMatchCategoryCard({ category }: { category: ResumeMatchCategory }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.05rem", margin: 0 }}>
          {category.label}
        </h3>
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d]" style={{ fontSize: 13 }}>
          {category.score}/100
        </span>
      </div>
      <div className="bg-[#f0e6ea] overflow-hidden" style={{ height: 6, borderRadius: 6, marginBottom: 10 }}>
        <div
          className="bg-[#ed1a24] h-full"
          style={{ borderRadius: 6, width: `${Math.min(100, Math.max(0, category.score))}%` }}
        />
      </div>
      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        {category.comment}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Delete the superseded report components**

```bash
git rm app/hub/account/report/CategorySection.tsx app/hub/account/report/RequirementRow.tsx app/hub/account/report/ActionPlanItem.tsx
```

- [ ] **Step 3: Rewrite `report/page.tsx`**

Replace the full contents of `d:\Work-Projects\merito-website-v2\app\hub\account\report\page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import ResumeMatchCategoryCard from "./ResumeMatchCategoryCard";

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
    .select("role_title, score, name, resume_match_status, resume_match_raw")
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

  if (current.resume_match_status !== "READY" || !current.resume_match_raw) {
    redirect("/hub/account");
  }

  const report = current.resume_match_raw as ResumeMatchReportReady;

  const displayName = current.name || user.email || "Candidate";
  const formattedDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
            {report.summary}
          </p>
        </div>

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "0 0 14px" }}>
          Match breakdown
        </h2>
        {report.categories.map((category) => (
          <ResumeMatchCategoryCard key={category.key} category={category} />
        ))}

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "32px 0 14px" }}>
          Strengths
        </h2>
        {report.strongPoints.map((point, i) => (
          <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "0 0 8px" }}>
            ✓ {point}
          </p>
        ))}

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "32px 0 14px" }}>
          Gaps to address
        </h2>
        {report.weakPoints.map((point, i) => (
          <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "0 0 8px" }}>
            ✗ {point}
          </p>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Rewrite `account/page.tsx`**

Replace the full contents of `d:\Work-Projects\merito-website-v2\app\hub\account\page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import DashboardClient from "./DashboardClient";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";

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
    .select("role_title, score, verdict, resume_match_status, resume_match_raw, created_at")
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

  const report: ResumeMatchReportReady | null =
    reportUnlocked && current.resume_match_status === "READY"
      ? (current.resume_match_raw as ResumeMatchReportReady)
      : null;

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

- [ ] **Step 5: Update `DashboardClient.tsx`'s type import**

In `d:\Work-Projects\merito-website-v2\app\hub\account\DashboardClient.tsx`, replace line 9:

```tsx
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
```

with:

```tsx
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
```

Replace both occurrences of `FitmentReportResult` (lines 24 and the `useState` generic) with `ResumeMatchReportReady`:

```tsx
  initialReport,
}: {
  roleTitle: string;
  score: number;
  prevScore: number | null;
  verdict: string;
  initialReportUnlocked: boolean;
  initialReport: ResumeMatchReportReady | null;
}) {
  const [modal, setModal] = useState<"none" | "report" | "changeRole">("none");
  const [reportUnlocked, setReportUnlocked] = useState(initialReportUnlocked);
  const [report, setReport] = useState<ResumeMatchReportReady | null>(initialReport);
```

- [ ] **Step 6: Rewrite `ScoreCard.tsx`'s strengths/gaps logic**

In `d:\Work-Projects\merito-website-v2\app\hub\account\ScoreCard.tsx`, replace line 4:

```tsx
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
```

with:

```tsx
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
```

Replace the `report` prop type (in the destructured props type block) from `report: FitmentReportResult | null;` to `report: ResumeMatchReportReady | null;`.

Replace lines 24-28 (the `allRequirements`/`topStrong`/`topMissing` derivation):

```tsx
  const allRequirements = report
    ? report.categories.flatMap((c) => (Array.isArray(c?.requirements) ? c.requirements : []))
    : [];
  const topStrong = allRequirements.find((r) => r.matchLevel === "strong");
  const topMissing = allRequirements.find((r) => r.matchLevel === "missing");
```

with:

```tsx
  const topStrong = report?.strongPoints[0];
  const topMissing = report?.weakPoints[0];
```

Replace the two usages of `{topStrong.requirement}` and `{topMissing.requirement}` (lines ~104 and ~120) with `{topStrong}` and `{topMissing}` respectively — `topStrong`/`topMissing` are now plain strings, not requirement objects.

- [ ] **Step 7: Update `ReportPaywallModal.tsx`'s pending/needs-cv handling**

In `d:\Work-Projects\merito-website-v2\app\hub\account\ReportPaywallModal.tsx`, replace line 4:

```tsx
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
```

with:

```tsx
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
```

Replace the props type (lines 6-14) `onUnlocked: (report: FitmentReportResult) => void;` with `onUnlocked: (report: ResumeMatchReportReady) => void;`.

Rename the `needsCv` state and its handling to `pending` (the new PENDING signal from Task 9's route, replacing the old `needs_cv` signal which no longer exists). Replace lines 16-45 (`handlePay` and the `needsCv` state declaration):

```tsx
  const [paying, setPaying] = useState(false);
  const [pending, setPending] = useState(false);
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
      if (data.status === "pending") {
        setPaying(false);
        setPending(true);
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

Replace the `{needsCv ? (...) : (...)}` conditional (lines 78-114) — change `needsCv` to `pending` and update the copy:

```tsx
        {pending ? (
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            Report unlocked — your resume-match score is still processing. Refresh this page in a moment to see it.
          </p>
        ) : (
```

(the rest of that block — the sample preview and the unlock button — is unchanged).

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: PASS across all `.test.ts` files — this task touches no test files itself, but confirms nothing else in the suite imported the deleted `CategorySection`/`RequirementRow`/`ActionPlanItem` or the old `FitmentReportResult` type in a way that breaks type-checking. If TypeScript errors surface here from the type swap, fix them inline before continuing (there are no other consumers per the Task 10 grep already run during planning, so none are expected).

- [ ] **Step 9: Manually verify in the browser**

Run: `npm run dev`. Since there's no live IntervueBox key yet, seed a `fitment_leads` row by hand in Supabase with `resume_match_status = 'READY'` and a `resume_match_raw` matching `ResumeMatchReportReady`'s shape (six categories, summary, strongPoints, weakPoints) plus a matching `report_unlocks` row, then load `/hub/account` and `/hub/account/report` as that user — confirm the score card's top-strength/top-gap chips and the full report page's category cards, strengths, and gaps render without runtime errors.

- [ ] **Step 10: Commit**

```bash
git add app/hub/account/page.tsx app/hub/account/DashboardClient.tsx app/hub/account/ScoreCard.tsx app/hub/account/ReportPaywallModal.tsx app/hub/account/report/page.tsx app/hub/account/report/ResumeMatchCategoryCard.tsx
git commit -m "feat: render IntervueBox resume-match report in the dashboard and full report page"
```

---

### Task 11: Retire the Claude-based fitment code and its dependencies

**Files:**
- Delete: `lib/scoreFitment.ts`, `lib/__tests__/scoreFitment.test.ts`
- Delete: `lib/generateFitmentReport.ts`, `lib/__tests__/generateFitmentReport.test.ts`
- Delete: `lib/parseCvFile.ts`, `lib/__tests__/parseCvFile.test.ts`
- Modify: `package.json`
- Modify: `next.config.ts`
- Modify: `.env.example`

**Interfaces:** None — this task only removes now-unused code. Tasks 7 and 9 already stopped importing `scoreFitment`, `generateFitmentReport`, and `parseCvFile`; this task deletes the now-dead files those imports used to point to.

- [ ] **Step 1: Delete the Claude-based fitment files and their tests**

```bash
git rm lib/scoreFitment.ts lib/__tests__/scoreFitment.test.ts lib/generateFitmentReport.ts lib/__tests__/generateFitmentReport.test.ts lib/parseCvFile.ts lib/__tests__/parseCvFile.test.ts
```

- [ ] **Step 2: Remove the now-unused npm dependencies**

In `d:\Work-Projects\merito-website-v2\package.json`, remove these lines from `dependencies`:

```json
    "@anthropic-ai/sdk": "^0.111.0",
```
```json
    "mammoth": "^1.12.0",
```
```json
    "pdf-parse": "1.1.4",
```

and this line from `devDependencies`:

```json
    "@types/pdf-parse": "^1.1.5",
```

Run: `npm install` (updates `package-lock.json` to drop the removed packages)

- [ ] **Step 3: Remove the now-unused webpack external config**

In `d:\Work-Projects\merito-website-v2\next.config.ts`, remove:

```ts
  // pdf-parse/mammoth bundle Node internals; keep them external to server bundling.
  serverExternalPackages: ["pdf-parse", "mammoth"],
```

- [ ] **Step 4: Remove the now-unused env var**

In `d:\Work-Projects\merito-website-v2\.env.example`, remove:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 5: Run the full test suite and build**

Run: `npx vitest run`
Expected: PASS across all remaining test files, with no references to the deleted modules.

Run: `npm run build`
Expected: succeeds with no type errors (confirms nothing still imports `@anthropic-ai/sdk`, `pdf-parse`, or `mammoth`).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json next.config.ts .env.example
git commit -m "chore: remove Claude-based fitment scoring and its dependencies"
```

---

## Not in scope — flagged for a follow-up plan

- **Phase C: the real AI interview step.** `POST /api/hub/start-ai-interview`, `getOrCreateInterviewAgent`/`sendInterviewInvitation` in `lib/intervuebox/`, the `fitment_interviews` table, the `app/api/webhooks/intervuebox/route.ts` HMAC-SHA256 webhook handler, and the `interview` step's UI in `ProgressRail.tsx` are all deferred — the webhook's exact JSON body shape is undocumented (only its signing scheme and event names are), and there's no sandbox key yet to verify against. See `specs/2026-07-17-intervuebox-integration-design.md` §"Data flow — Phase C" for what's already decided when that plan gets written.
- **Landing-widget polling interval/timeout tuning.** Task 8 ships with provisional constants (3s interval, 60s timeout). Once a live `INTERVUEBOX_API_KEY` exists, measure real PENDING→READY latency for `getResumeMatchReport` and adjust, or replace polling with an email-when-ready fallback if latency turns out to be minutes rather than seconds (design doc's own explicit open item).
- **Dropping the now-unused `fitment_reports` table.** Left in place per Task 9's Global Constraints note — a later cleanup migration, not blocking anything in this plan.
