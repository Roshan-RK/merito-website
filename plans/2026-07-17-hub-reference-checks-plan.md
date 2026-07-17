# Merito HUB — Reference Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Hub candidate invite referees by email, have each referee rate them on 7 categories (or decline) via a magic-link form, auto-remind silent referees, and auto-complete the check once 3 referees respond — surfaced as the "Reference checks" step in the account dashboard.

**Architecture:** Native to this Next.js 16 App Router repo — no call into the `merito-ats-prd` Django backend. Three new Supabase tables (`reference_checks`, `referees`, `reference_tokens`), a `lib/` layer of flat testable modules (mirroring the existing `lib/reportUnlocks.ts` pattern), Route Handlers under `app/api/hub/references/`, two new pages (candidate-facing dashboard section + public referee feedback form), a Vercel Cron job for reminders, and one prop-plumbing change through `ProgressRail.tsx`.

**Tech Stack:** Next.js 16.2.4 App Router (async `params`/`cookies()` — confirmed against `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`), `@supabase/supabase-js` 2.110.5 (service-role client, no ORM), `resend` 6.12.2, `zod` 4.4.3, Vitest 4.1.10 with hand-rolled Supabase chain mocks (no `msw`/test-db in this repo).

## Global Constraints

- Reimplement RefTrack's mechanic natively — do not call the ATS Django API. (Spec decision.)
- No paywall in this phase — the flow works end-to-end unauthenticated by payment status. (Spec decision.)
- `reference_checks` keyed off `user_id` only, one active check per user at a time. (Spec decision — enforced via a partial unique index.)
- 7-category rubric, fixed: `knowledge-application`, `initiative`, `teamwork`, `communication`, `discipline`, `problem-solving`, `leadership-skills`. 1–5 scale each. (Spec decision.)
- Minimum 3 completed referees to auto-complete a check; maximum 10 referee slots; maximum 3 reminders per referee. (Spec decision.)
- Referee table is named `referees`, never `references` (reserved SQL keyword). (Spec decision, self-review fix.)
- Tokens are opaque, random, DB-backed rows in `reference_tokens` — not signed JWTs. Single-use: `used_at` is set the moment a token is consumed (feedback submit or decline), and every read path rejects an already-used or expired token before doing anything else.
- `referees.last_reminded_at` (nullable timestamptz) is required for reminder cadence — added during planning; the spec's schema sketch omitted it, but "reminders" cannot be correctly paced without knowing when the last one went out (see Task 1).
- Reminder cadence: 3 days between reminders, capped at 3 reminders total.
- Email via the existing `resend` package, inline HTML/text — no template-DB layer. Follow the `escapeHtml` pattern already in `app/api/contact/route.ts`.
- `SUPABASE_SERVICE_ROLE_KEY`-based `getSupabaseServerClient()` (from `lib/supabase.ts`) is used for all reference-check DB writes/reads inside route handlers and `lib/` modules — these are trusted server contexts performing actions on the authenticated user's own behalf, matching the existing `unlockReport`/`isReportUnlocked` pattern. RLS (Task 1) is the defense for any future client-side Supabase read, not the primary authorization mechanism here — routes authorize by checking `user.id` from `createSupabaseServerClient()`'s session before ever touching the service-role client.
- Match existing code style: double quotes, semicolons, `lib/` flat-file convention, Tailwind arbitrary-value className strings mixed with inline `style={}` for any UI (see `ScoreCard.tsx`, `ProgressRail.tsx`).
- Dynamic route params are `Promise`-typed in this Next.js version — always `await params`. Confirmed via `app/insights/[slug]/page.tsx:830-843` and the Next docs file cited above.
- Test command: `npx vitest run <path>`. No component/browser test infra exists in this repo (confirmed by the accounts-phase plan) — new UI components get manual verification steps, not invented test infra.
- Never `git add -A`; stage explicitly.
- `docs/` is gitignored in this repo — this plan and its spec live in `plans/` and `specs/`, which are tracked normally.
- Migrations in `supabase/migrations/` are never applied automatically by this plan or by CI — they're written here and applied once, by hand, in the Supabase SQL editor (same convention as every prior Hub migration).

---

### Task 1: Database migration — `reference_checks`, `referees`, `reference_tokens`

**Files:**
- Create: `supabase/migrations/0006_reference_checks.sql`
- Modify: `.env.example`

**Interfaces:**
- Produces: tables `reference_checks(id, user_id, status, min_references, created_at, completed_at)`, `referees(id, reference_check_id, name, email, phone, linkedin_url, organization, experience_level, role, custom_role, ratings, overall_feedback, status, reminder_count, last_reminded_at, feedback_opened_at, created_at)`, `reference_tokens(token, reference_id, expires_at, used_at, created_at)`.

- [ ] **Step 1: Write the migration**

Create `d:\Work-Projects\merito-website-v2\supabase\migrations\0006_reference_checks.sql`:

```sql
create type reference_check_status as enum ('initiated', 'in_progress', 'completed', 'cancelled');
create type referee_status as enum ('pending', 'completed', 'rejected');
create type referee_experience_level as enum ('fresher', 'experienced');

create table reference_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  status reference_check_status not null default 'initiated',
  min_references int not null default 3,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index reference_checks_one_active_per_user
  on reference_checks (user_id)
  where status in ('initiated', 'in_progress');

create table referees (
  id uuid primary key default gen_random_uuid(),
  reference_check_id uuid not null references reference_checks(id),
  name text not null,
  email text not null,
  phone text,
  linkedin_url text,
  organization text,
  experience_level referee_experience_level,
  role text not null,
  custom_role text,
  ratings jsonb,
  overall_feedback text,
  status referee_status not null default 'pending',
  reminder_count int not null default 0,
  last_reminded_at timestamptz,
  feedback_opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reference_check_id, email)
);

create table reference_tokens (
  token text primary key,
  reference_id uuid not null references referees(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table reference_checks enable row level security;
alter table referees enable row level security;
alter table reference_tokens enable row level security;

create policy "Users can view their own reference checks"
  on reference_checks
  for select
  using (auth.uid() = user_id);

create policy "Users can view their own referees"
  on referees
  for select
  using (
    exists (
      select 1 from reference_checks
      where reference_checks.id = referees.reference_check_id
      and reference_checks.user_id = auth.uid()
    )
  );
```

`reference_tokens` gets RLS enabled but no policies — with RLS on and zero policies, every role except the service-role key (which bypasses RLS entirely) is denied all access by default. That's intentional: tokens must never be readable from a client-side/anon-key Supabase call.

- [ ] **Step 2: Add the reminder-cadence and cron env vars**

In `d:\Work-Projects\merito-website-v2\.env.example`, append:

```
REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS=14
CRON_SECRET=
```

- [ ] **Step 3: Note application, don't apply**

This migration is not run by this plan. Note in your task report that it must be applied by hand in the Supabase project's SQL editor — no credentials exist in this environment to run it directly.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_reference_checks.sql .env.example
git commit -m "feat(hub): add reference_checks/referees/reference_tokens schema"
```

---

### Task 2: `lib/referenceTokens.ts` — opaque token generation, validation, single-use consumption

**Files:**
- Create: `lib/referenceTokens.ts`
- Test: `lib/__tests__/referenceTokens.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()` from `lib/supabase.ts`.
- Produces: `createRefereeToken(refereeId: string): Promise<string>`; `validateRefereeToken(token: string): Promise<TokenValidation>` where `TokenValidation = { valid: true; refereeId: string } | { valid: false; reason: "not_found" | "expired" | "used" }`; `consumeRefereeToken(token: string): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `d:\Work-Projects\merito-website-v2\lib\__tests__\referenceTokens.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const maybeSingleMock = vi.fn();
const updateMock = vi.fn();
const updateEqMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("referenceTokens", () => {
  beforeEach(() => {
    fromMock.mockReset();
    insertMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    maybeSingleMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();
    delete process.env.REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS;
  });

  describe("createRefereeToken", () => {
    it("inserts a token row with a future expiry and returns the token", async () => {
      fromMock.mockReturnValue({ insert: insertMock });
      insertMock.mockResolvedValue({ error: null });
      const { createRefereeToken } = await import("../referenceTokens");

      const token = await createRefereeToken("referee-1");

      expect(fromMock).toHaveBeenCalledWith("reference_tokens");
      expect(typeof token).toBe("string");
      expect(token.length).toBe(64); // 32 bytes hex-encoded
      const insertedRow = insertMock.mock.calls[0][0];
      expect(insertedRow.reference_id).toBe("referee-1");
      expect(insertedRow.token).toBe(token);
      expect(new Date(insertedRow.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it("throws if Supabase returns an error", async () => {
      fromMock.mockReturnValue({ insert: insertMock });
      insertMock.mockResolvedValue({ error: { message: "db error" } });
      const { createRefereeToken } = await import("../referenceTokens");

      await expect(createRefereeToken("referee-1")).rejects.toThrow();
    });
  });

  describe("validateRefereeToken", () => {
    function mockLookup(result: { data: unknown; error: unknown }) {
      fromMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock });
      eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
      maybeSingleMock.mockResolvedValue(result);
    }

    it("returns valid:false reason:not_found when no row matches", async () => {
      mockLookup({ data: null, error: null });
      const { validateRefereeToken } = await import("../referenceTokens");

      const result = await validateRefereeToken("missing-token");
      expect(result).toEqual({ valid: false, reason: "not_found" });
    });

    it("returns valid:false reason:used when used_at is set", async () => {
      mockLookup({
        data: { reference_id: "referee-1", expires_at: new Date(Date.now() + 100000).toISOString(), used_at: new Date().toISOString() },
        error: null,
      });
      const { validateRefereeToken } = await import("../referenceTokens");

      const result = await validateRefereeToken("used-token");
      expect(result).toEqual({ valid: false, reason: "used" });
    });

    it("returns valid:false reason:expired when expires_at is in the past", async () => {
      mockLookup({
        data: { reference_id: "referee-1", expires_at: new Date(Date.now() - 1000).toISOString(), used_at: null },
        error: null,
      });
      const { validateRefereeToken } = await import("../referenceTokens");

      const result = await validateRefereeToken("expired-token");
      expect(result).toEqual({ valid: false, reason: "expired" });
    });

    it("returns valid:true with refereeId for a live, unused token", async () => {
      mockLookup({
        data: { reference_id: "referee-1", expires_at: new Date(Date.now() + 100000).toISOString(), used_at: null },
        error: null,
      });
      const { validateRefereeToken } = await import("../referenceTokens");

      const result = await validateRefereeToken("good-token");
      expect(result).toEqual({ valid: true, refereeId: "referee-1" });
    });
  });

  describe("consumeRefereeToken", () => {
    it("sets used_at on the matching token row", async () => {
      fromMock.mockReturnValue({ update: updateMock });
      updateMock.mockReturnValue({ eq: updateEqMock });
      updateEqMock.mockResolvedValue({ error: null });
      const { consumeRefereeToken } = await import("../referenceTokens");

      await consumeRefereeToken("good-token");

      expect(fromMock).toHaveBeenCalledWith("reference_tokens");
      expect(updateEqMock).toHaveBeenCalledWith("token", "good-token");
      const updatedRow = updateMock.mock.calls[0][0];
      expect(updatedRow.used_at).toBeTruthy();
    });

    it("throws if Supabase returns an error", async () => {
      fromMock.mockReturnValue({ update: updateMock });
      updateMock.mockReturnValue({ eq: updateEqMock });
      updateEqMock.mockResolvedValue({ error: { message: "db error" } });
      const { consumeRefereeToken } = await import("../referenceTokens");

      await expect(consumeRefereeToken("good-token")).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run lib/__tests__/referenceTokens.test.ts`
Expected: FAIL — `Cannot find module '../referenceTokens'`.

- [ ] **Step 3: Implement `lib/referenceTokens.ts`**

Create `d:\Work-Projects\merito-website-v2\lib\referenceTokens.ts`:

```ts
import { randomBytes } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";

const TOKEN_BYTES = 32;
const DEFAULT_VALIDITY_DAYS = 14;

export type TokenValidation =
  | { valid: true; refereeId: string }
  | { valid: false; reason: "not_found" | "expired" | "used" };

function getValidityDays(): number {
  const raw = Number(process.env.REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_VALIDITY_DAYS;
}

export async function createRefereeToken(refereeId: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + getValidityDays() * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("reference_tokens").insert({
    token,
    reference_id: refereeId,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to create reference token: ${error.message}`);
  }

  return token;
}

export async function validateRefereeToken(token: string): Promise<TokenValidation> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("reference_tokens")
    .select("reference_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, reason: "not_found" };
  }
  if (data.used_at) {
    return { valid: false, reason: "used" };
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, refereeId: data.reference_id };
}

export async function consumeRefereeToken(token: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("reference_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);

  if (error) {
    throw new Error(`Failed to consume reference token: ${error.message}`);
  }
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npx vitest run lib/__tests__/referenceTokens.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/referenceTokens.ts lib/__tests__/referenceTokens.test.ts
git commit -m "feat(hub): add opaque DB-backed reference feedback tokens"
```

---

### Task 3: `lib/referenceEmails.ts` — invite and reminder emails via Resend

**Files:**
- Create: `lib/referenceEmails.ts`
- Test: `lib/__tests__/referenceEmails.test.ts`

**Interfaces:**
- Consumes: `resend` package's `Resend` class.
- Produces: `sendRefereeInviteEmail(params: { to: string; refereeName: string; candidateName: string; token: string }): Promise<void>`; `sendRefereeReminderEmail(params: { to: string; refereeName: string; candidateName: string; token: string }): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `d:\Work-Projects\merito-website-v2\lib\__tests__\referenceEmails.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

const ORIGINAL_ENV = { ...process.env };

describe("referenceEmails", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: "re_test", CONTACT_FROM_EMAIL: "admin@merito.ai", NEXT_PUBLIC_SITE_URL: "https://www.merito.in" };
  });

  describe("sendRefereeInviteEmail", () => {
    it("sends an email with a feedback link built from the token", async () => {
      const { sendRefereeInviteEmail } = await import("../referenceEmails");

      await sendRefereeInviteEmail({ to: "referee@example.com", refereeName: "Jane Doe", candidateName: "Alex Kumar", token: "abc123" });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const call = sendMock.mock.calls[0][0];
      expect(call.to).toEqual(["referee@example.com"]);
      expect(call.from).toBe("admin@merito.ai");
      expect(call.subject).toContain("Alex Kumar");
      expect(call.html).toContain("https://www.merito.in/hub/references/feedback/abc123");
      expect(call.text).toContain("https://www.merito.in/hub/references/feedback/abc123");
    });

    it("escapes HTML in referee and candidate names", async () => {
      const { sendRefereeInviteEmail } = await import("../referenceEmails");

      await sendRefereeInviteEmail({ to: "referee@example.com", refereeName: "<script>alert(1)</script>", candidateName: "Alex", token: "abc123" });

      const call = sendMock.mock.calls[0][0];
      expect(call.html).not.toContain("<script>");
    });

    it("throws when RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;
      const { sendRefereeInviteEmail } = await import("../referenceEmails");

      await expect(
        sendRefereeInviteEmail({ to: "referee@example.com", refereeName: "Jane", candidateName: "Alex", token: "abc123" })
      ).rejects.toThrow();
    });
  });

  describe("sendRefereeReminderEmail", () => {
    it("sends a reminder email referencing the same feedback link", async () => {
      const { sendRefereeReminderEmail } = await import("../referenceEmails");

      await sendRefereeReminderEmail({ to: "referee@example.com", refereeName: "Jane Doe", candidateName: "Alex Kumar", token: "abc123" });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const call = sendMock.mock.calls[0][0];
      expect(call.subject.toLowerCase()).toContain("reminder");
      expect(call.html).toContain("https://www.merito.in/hub/references/feedback/abc123");
    });
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run lib/__tests__/referenceEmails.test.ts`
Expected: FAIL — `Cannot find module '../referenceEmails'`.

- [ ] **Step 3: Implement `lib/referenceEmails.ts`**

Create `d:\Work-Projects\merito-website-v2\lib\referenceEmails.ts`:

```ts
import { Resend } from "resend";

type RefereeEmailParams = {
  to: string;
  refereeName: string;
  candidateName: string;
  token: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Email service is not configured (RESEND_API_KEY missing).");
  }
  return new Resend(apiKey);
}

function getFromEmail(): string {
  const fromEmail = process.env.CONTACT_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("Email service is not configured (CONTACT_FROM_EMAIL missing).");
  }
  return fromEmail;
}

function feedbackUrl(token: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.merito.in";
  return `${siteUrl}/hub/references/feedback/${token}`;
}

export async function sendRefereeInviteEmail(params: RefereeEmailParams): Promise<void> {
  const resend = getResendClient();
  const url = feedbackUrl(params.token);
  const safeReferee = escapeHtml(params.refereeName);
  const safeCandidate = escapeHtml(params.candidateName);

  await resend.emails.send({
    from: getFromEmail(),
    to: [params.to],
    subject: `${params.candidateName} listed you as a professional reference`,
    text: `Hi ${params.refereeName},\n\n${params.candidateName} listed you as a reference on Merito. Please share quick feedback here:\n${url}\n\nThis link expires in ${process.env.REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS || "14"} days.`,
    html: `<p>Hi ${safeReferee},</p><p>${safeCandidate} listed you as a reference on Merito. Please share quick feedback:</p><p><a href="${url}">${url}</a></p><p>This link expires in ${process.env.REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS || "14"} days.</p>`,
  });
}

export async function sendRefereeReminderEmail(params: RefereeEmailParams): Promise<void> {
  const resend = getResendClient();
  const url = feedbackUrl(params.token);
  const safeReferee = escapeHtml(params.refereeName);
  const safeCandidate = escapeHtml(params.candidateName);

  await resend.emails.send({
    from: getFromEmail(),
    to: [params.to],
    subject: `Reminder: ${params.candidateName} is waiting on your feedback`,
    text: `Hi ${params.refereeName},\n\nJust a reminder — ${params.candidateName} is waiting on your reference feedback:\n${url}`,
    html: `<p>Hi ${safeReferee},</p><p>Just a reminder — ${safeCandidate} is waiting on your reference feedback:</p><p><a href="${url}">${url}</a></p>`,
  });
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npx vitest run lib/__tests__/referenceEmails.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/referenceEmails.ts lib/__tests__/referenceEmails.test.ts
git commit -m "feat(hub): add referee invite/reminder emails via Resend"
```

---

### Task 4: `lib/referenceChecks.ts` — core business logic

**Files:**
- Create: `lib/referenceChecks.ts`
- Test: `lib/__tests__/referenceChecks.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()` from `lib/supabase.ts`.
- Produces:
  - `MIN_REFERENCES = 3`, `MAX_REFEREES = 10`, `MAX_REMINDERS = 3`, `REMINDER_INTERVAL_DAYS = 3` (exported consts)
  - `type RefereeRole = "faculty" | "classmate" | "internship-colleague" | "internship-manager" | "manager" | "team-lead" | "teammate" | "client" | "other"`
  - `type RefereeInput = { name: string; email: string; phone?: string; linkedinUrl?: string; organization?: string; experienceLevel?: "fresher" | "experienced"; role: RefereeRole; customRole?: string }`
  - `initiateReferenceCheck(userId: string): Promise<{ id: string }>` — throws `Error("ALREADY_ACTIVE")` if one exists
  - `getActiveReferenceCheckId(userId: string): Promise<string | null>`
  - `addReferee(checkId: string, input: RefereeInput): Promise<{ id: string }>` — throws `Error("MAX_REFEREES_REACHED")` at the cap
  - `getReferenceCheckStatus(userId: string): Promise<ReferenceCheckStatusResult | null>`
  - `getRefereeForUser(userId: string, refereeId: string): Promise<RefereeForUser | null>`
  - `recordRefereeFeedback(refereeId: string, input: { ratings: { category: string; value: number }[]; overallFeedback: string }): Promise<void>`
  - `recordRefereeDecline(refereeId: string): Promise<void>`
  - `incrementReminderCount(refereeId: string): Promise<void>`
  - `getCandidateDisplayName(userId: string): Promise<string>`
  - `getStaleRefereesForReminder(): Promise<{ id: string; name: string; email: string; reference_check_id: string }[]>`

- [ ] **Step 1: Write the failing tests**

Create `d:\Work-Projects\merito-website-v2\lib\__tests__\referenceChecks.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("referenceChecks", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  describe("initiateReferenceCheck", () => {
    it("throws ALREADY_ACTIVE when an initiated/in_progress check exists", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "check-1" }, error: null });
      const inFn = vi.fn().mockReturnValue({ maybeSingle });
      const eqFn = vi.fn().mockReturnValue({ in: inFn });
      const select = vi.fn().mockReturnValue({ eq: eqFn });
      fromMock.mockReturnValue({ select });

      const { initiateReferenceCheck } = await import("../referenceChecks");
      await expect(initiateReferenceCheck("user-1")).rejects.toThrow("ALREADY_ACTIVE");
    });

    it("inserts a new reference_checks row when none is active", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const inFn = vi.fn().mockReturnValue({ maybeSingle });
      const eqFn = vi.fn().mockReturnValue({ in: inFn });
      const select = vi.fn().mockReturnValue({ eq: eqFn });

      const insertSelect = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "check-new" }, error: null }) });
      const insert = vi.fn().mockReturnValue({ select: insertSelect });

      fromMock.mockReturnValueOnce({ select }).mockReturnValueOnce({ insert });

      const { initiateReferenceCheck } = await import("../referenceChecks");
      const result = await initiateReferenceCheck("user-1");
      expect(result).toEqual({ id: "check-new" });
      expect(insert).toHaveBeenCalledWith({ user_id: "user-1", min_references: 3 });
    });
  });

  describe("addReferee", () => {
    it("throws MAX_REFEREES_REACHED at the 10-slot cap", async () => {
      const select = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 10, error: null }) });
      fromMock.mockReturnValue({ select });

      const { addReferee } = await import("../referenceChecks");
      await expect(
        addReferee("check-1", { name: "Jane", email: "jane@example.com", role: "manager" })
      ).rejects.toThrow("MAX_REFEREES_REACHED");
    });

    it("inserts a referee row and flips the check to in_progress", async () => {
      const countSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 0, error: null }) });
      const insertSelect = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "referee-1" }, error: null }) });
      const insert = vi.fn().mockReturnValue({ select: insertSelect });
      const updateEq2 = vi.fn().mockResolvedValue({ error: null });
      const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
      const update = vi.fn().mockReturnValue({ eq: updateEq1 });

      fromMock
        .mockReturnValueOnce({ select: countSelect })
        .mockReturnValueOnce({ insert })
        .mockReturnValueOnce({ update });

      const { addReferee } = await import("../referenceChecks");
      const result = await addReferee("check-1", { name: "Jane", email: "jane@example.com", role: "manager" });

      expect(result).toEqual({ id: "referee-1" });
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ reference_check_id: "check-1", name: "Jane", email: "jane@example.com", role: "manager" })
      );
      expect(update).toHaveBeenCalledWith({ status: "in_progress" });
    });
  });

  describe("getReferenceCheckStatus", () => {
    it("returns null when the user has no reference check", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const order = vi.fn().mockReturnValue({ limit });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      fromMock.mockReturnValue({ select });

      const { getReferenceCheckStatus } = await import("../referenceChecks");
      const result = await getReferenceCheckStatus("user-1");
      expect(result).toBeNull();
    });

    it("returns the check plus its referees", async () => {
      const checkMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "check-1", status: "in_progress", min_references: 3 }, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle: checkMaybeSingle });
      const order1 = vi.fn().mockReturnValue({ limit });
      const eq1 = vi.fn().mockReturnValue({ order: order1 });
      const checkSelect = vi.fn().mockReturnValue({ eq: eq1 });

      const refereesOrder = vi.fn().mockResolvedValue({
        data: [{ id: "r1", name: "Jane", email: "jane@example.com", status: "pending", reminder_count: 0 }],
        error: null,
      });
      const eq2 = vi.fn().mockReturnValue({ order: refereesOrder });
      const refereesSelect = vi.fn().mockReturnValue({ eq: eq2 });

      fromMock.mockReturnValueOnce({ select: checkSelect }).mockReturnValueOnce({ select: refereesSelect });

      const { getReferenceCheckStatus } = await import("../referenceChecks");
      const result = await getReferenceCheckStatus("user-1");

      expect(result).toEqual({
        checkId: "check-1",
        status: "in_progress",
        minReferences: 3,
        referees: [{ id: "r1", name: "Jane", email: "jane@example.com", status: "pending", reminder_count: 0 }],
      });
    });
  });

  describe("recordRefereeFeedback", () => {
    it("marks the referee completed and auto-completes the check at the threshold", async () => {
      const refereeSingle = vi.fn().mockResolvedValue({ data: { reference_check_id: "check-1" }, error: null });
      const refereeEq = vi.fn().mockReturnValue({ single: refereeSingle });
      const refereeSelect = vi.fn().mockReturnValue({ eq: refereeEq });

      const updateEq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq: updateEq });

      const checkSingle = vi.fn().mockResolvedValue({ data: { min_references: 3, status: "in_progress" }, error: null });
      const checkEq = vi.fn().mockReturnValue({ single: checkSingle });
      const checkSelect = vi.fn().mockReturnValue({ eq: checkEq });

      const countEq2 = vi.fn().mockResolvedValue({ count: 3, error: null });
      const countEq1 = vi.fn().mockReturnValue({ eq: countEq2 });
      const countSelect = vi.fn().mockReturnValue({ eq: countEq1 });

      const completeUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const completeUpdate = vi.fn().mockReturnValue({ eq: completeUpdateEq });

      fromMock
        .mockReturnValueOnce({ select: refereeSelect }) // fetch referee -> check id
        .mockReturnValueOnce({ update }) // update referee to completed
        .mockReturnValueOnce({ select: checkSelect }) // fetch check
        .mockReturnValueOnce({ select: countSelect }) // count completed referees
        .mockReturnValueOnce({ update: completeUpdate }); // mark check completed

      const { recordRefereeFeedback } = await import("../referenceChecks");
      await recordRefereeFeedback("referee-1", {
        ratings: [{ category: "teamwork", value: 5 }],
        overallFeedback: "Great teammate.",
      });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed", overall_feedback: "Great teammate." })
      );
      expect(completeUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    });
  });

  describe("recordRefereeDecline", () => {
    it("marks the referee rejected", async () => {
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq });
      fromMock.mockReturnValue({ update });

      const { recordRefereeDecline } = await import("../referenceChecks");
      await recordRefereeDecline("referee-1");

      expect(update).toHaveBeenCalledWith({ status: "rejected" });
      expect(eq).toHaveBeenCalledWith("id", "referee-1");
    });
  });

  describe("getCandidateDisplayName", () => {
    it("returns the fitment_leads name when present", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: { name: "Alex Kumar" }, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const order = vi.fn().mockReturnValue({ limit });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      fromMock.mockReturnValue({ select });

      const { getCandidateDisplayName } = await import("../referenceChecks");
      const result = await getCandidateDisplayName("user-1");
      expect(result).toBe("Alex Kumar");
    });

    it("falls back to a generic label when no name is on file", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const order = vi.fn().mockReturnValue({ limit });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      fromMock.mockReturnValue({ select });

      const { getCandidateDisplayName } = await import("../referenceChecks");
      const result = await getCandidateDisplayName("user-1");
      expect(result).toBe("A Merito candidate");
    });
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run lib/__tests__/referenceChecks.test.ts`
Expected: FAIL — `Cannot find module '../referenceChecks'`.

- [ ] **Step 3: Implement `lib/referenceChecks.ts`**

Create `d:\Work-Projects\merito-website-v2\lib\referenceChecks.ts`:

```ts
import { getSupabaseServerClient } from "@/lib/supabase";

export const MIN_REFERENCES = 3;
export const MAX_REFEREES = 10;
export const MAX_REMINDERS = 3;
export const REMINDER_INTERVAL_DAYS = 3;

export type RefereeRole =
  | "faculty"
  | "classmate"
  | "internship-colleague"
  | "internship-manager"
  | "manager"
  | "team-lead"
  | "teammate"
  | "client"
  | "other";

export type RefereeInput = {
  name: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  organization?: string;
  experienceLevel?: "fresher" | "experienced";
  role: RefereeRole;
  customRole?: string;
};

export type RefereeRow = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "completed" | "rejected";
  reminder_count: number;
};

export type ReferenceCheckStatusResult = {
  checkId: string;
  status: "initiated" | "in_progress" | "completed" | "cancelled";
  minReferences: number;
  referees: RefereeRow[];
};

export type RefereeForUser = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "completed" | "rejected";
  reminderCount: number;
};

export async function initiateReferenceCheck(userId: string): Promise<{ id: string }> {
  const supabase = getSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("reference_checks")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["initiated", "in_progress"])
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check for an existing reference check: ${existingError.message}`);
  }
  if (existing) {
    throw new Error("ALREADY_ACTIVE");
  }

  const { data, error } = await supabase
    .from("reference_checks")
    .insert({ user_id: userId, min_references: MIN_REFERENCES })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to initiate reference check: ${error?.message}`);
  }

  return { id: data.id };
}

export async function getActiveReferenceCheckId(userId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("reference_checks")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["initiated", "in_progress"])
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up active reference check: ${error.message}`);
  }
  return data?.id ?? null;
}

export async function addReferee(checkId: string, input: RefereeInput): Promise<{ id: string }> {
  const supabase = getSupabaseServerClient();

  const { count, error: countError } = await supabase
    .from("referees")
    .select("id", { count: "exact", head: true })
    .eq("reference_check_id", checkId);

  if (countError) {
    throw new Error(`Failed to count referees: ${countError.message}`);
  }
  if ((count ?? 0) >= MAX_REFEREES) {
    throw new Error("MAX_REFEREES_REACHED");
  }

  const { data, error } = await supabase
    .from("referees")
    .insert({
      reference_check_id: checkId,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      linkedin_url: input.linkedinUrl ?? null,
      organization: input.organization ?? null,
      experience_level: input.experienceLevel ?? null,
      role: input.role,
      custom_role: input.customRole ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to add referee: ${error?.message}`);
  }

  await supabase.from("reference_checks").update({ status: "in_progress" }).eq("id", checkId).eq("status", "initiated");

  return { id: data.id };
}

export async function getReferenceCheckStatus(userId: string): Promise<ReferenceCheckStatusResult | null> {
  const supabase = getSupabaseServerClient();

  const { data: check, error: checkError } = await supabase
    .from("reference_checks")
    .select("id, status, min_references")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to load reference check: ${checkError.message}`);
  }
  if (!check) return null;

  const { data: referees, error: refereesError } = await supabase
    .from("referees")
    .select("id, name, email, status, reminder_count")
    .eq("reference_check_id", check.id)
    .order("created_at", { ascending: true });

  if (refereesError) {
    throw new Error(`Failed to load referees: ${refereesError.message}`);
  }

  return {
    checkId: check.id,
    status: check.status,
    minReferences: check.min_references,
    referees: (referees ?? []) as RefereeRow[],
  };
}

export async function getRefereeForUser(userId: string, refereeId: string): Promise<RefereeForUser | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("referees")
    .select("id, name, email, status, reminder_count, reference_check_id, reference_checks!inner(user_id)")
    .eq("id", refereeId)
    .eq("reference_checks.user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    status: data.status,
    reminderCount: data.reminder_count,
  };
}

export async function recordRefereeFeedback(
  refereeId: string,
  input: { ratings: { category: string; value: number }[]; overallFeedback: string }
): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: referee, error: refereeError } = await supabase
    .from("referees")
    .select("reference_check_id")
    .eq("id", refereeId)
    .single();

  if (refereeError || !referee) {
    throw new Error(`Referee not found: ${refereeError?.message}`);
  }

  const { error } = await supabase
    .from("referees")
    .update({
      ratings: input.ratings,
      overall_feedback: input.overallFeedback,
      status: "completed",
      feedback_opened_at: new Date().toISOString(),
    })
    .eq("id", refereeId);

  if (error) {
    throw new Error(`Failed to record referee feedback: ${error.message}`);
  }

  await maybeCompleteCheck(referee.reference_check_id);
}

export async function recordRefereeDecline(refereeId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("referees").update({ status: "rejected" }).eq("id", refereeId);

  if (error) {
    throw new Error(`Failed to record referee decline: ${error.message}`);
  }
}

async function maybeCompleteCheck(checkId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: check, error: checkError } = await supabase
    .from("reference_checks")
    .select("min_references, status")
    .eq("id", checkId)
    .single();

  if (checkError || !check || check.status === "completed") return;

  const { count, error: countError } = await supabase
    .from("referees")
    .select("id", { count: "exact", head: true })
    .eq("reference_check_id", checkId)
    .eq("status", "completed");

  if (countError) return;

  if ((count ?? 0) >= check.min_references) {
    await supabase
      .from("reference_checks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", checkId);
  }
}

export async function incrementReminderCount(refereeId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("referees").select("reminder_count").eq("id", refereeId).single();

  if (error || !data) {
    throw new Error(`Referee not found: ${error?.message}`);
  }

  const { error: updateError } = await supabase
    .from("referees")
    .update({ reminder_count: data.reminder_count + 1, last_reminded_at: new Date().toISOString() })
    .eq("id", refereeId);

  if (updateError) {
    throw new Error(`Failed to increment reminder count: ${updateError.message}`);
  }
}

export async function getCandidateDisplayName(userId: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("fitment_leads")
    .select("name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.name?.trim() || "A Merito candidate";
}

export async function getStaleRefereesForReminder(): Promise<
  { id: string; name: string; email: string; reference_check_id: string }[]
> {
  const supabase = getSupabaseServerClient();
  const cutoff = new Date(Date.now() - REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("referees")
    .select("id, name, email, reference_check_id")
    .eq("status", "pending")
    .lt("reminder_count", MAX_REMINDERS)
    .or(`last_reminded_at.lt.${cutoff},and(last_reminded_at.is.null,created_at.lt.${cutoff})`);

  if (error) {
    throw new Error(`Failed to load stale referees: ${error.message}`);
  }

  return data ?? [];
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npx vitest run lib/__tests__/referenceChecks.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/referenceChecks.ts lib/__tests__/referenceChecks.test.ts
git commit -m "feat(hub): add reference-check core business logic"
```

---

### Task 5: `POST /api/hub/references/initiate` and `POST /api/hub/references/add-referee`

**Files:**
- Create: `app/api/hub/references/initiate/route.ts`
- Create: `app/api/hub/references/add-referee/route.ts`
- Test: `app/api/hub/references/initiate/__tests__/route.test.ts`
- Test: `app/api/hub/references/add-referee/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `initiateReferenceCheck`, `getActiveReferenceCheckId`, `addReferee`, `getCandidateDisplayName` from `lib/referenceChecks.ts`; `createRefereeToken` from `lib/referenceTokens.ts`; `sendRefereeInviteEmail` from `lib/referenceEmails.ts`; `createSupabaseServerClient` from `lib/supabaseAuthServer.ts`.
- Produces: `POST /api/hub/references/initiate` → `{ checkId: string }` (201) or `{ error }` (401/409); `POST /api/hub/references/add-referee` → `{ refereeId: string }` (201) or `{ error }` (401/400/409).

- [ ] **Step 1: Write the failing test for `initiate`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\initiate\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const initiateReferenceCheckMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/referenceChecks", () => ({
  initiateReferenceCheck: initiateReferenceCheckMock,
}));

async function importRoute() {
  return await import("../route");
}

describe("POST /api/hub/references/initiate", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    initiateReferenceCheckMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(new Request("http://localhost/api/hub/references/initiate", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("returns 201 with the new check id", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    initiateReferenceCheckMock.mockResolvedValue({ id: "check-1" });
    const { POST } = await importRoute();
    const response = await POST(new Request("http://localhost/api/hub/references/initiate", { method: "POST" }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toEqual({ checkId: "check-1" });
  });

  it("returns 409 when a check is already active", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    initiateReferenceCheckMock.mockRejectedValue(new Error("ALREADY_ACTIVE"));
    const { POST } = await importRoute();
    const response = await POST(new Request("http://localhost/api/hub/references/initiate", { method: "POST" }));
    expect(response.status).toBe(409);
  });
});
```

- [ ] **Step 2: Write the failing test for `add-referee`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\add-referee\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const getActiveReferenceCheckIdMock = vi.fn();
const addRefereeMock = vi.fn();
const getCandidateDisplayNameMock = vi.fn();
const createRefereeTokenMock = vi.fn();
const sendRefereeInviteEmailMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/referenceChecks", () => ({
  getActiveReferenceCheckId: getActiveReferenceCheckIdMock,
  addReferee: addRefereeMock,
  getCandidateDisplayName: getCandidateDisplayNameMock,
}));
vi.mock("@/lib/referenceTokens", () => ({
  createRefereeToken: createRefereeTokenMock,
}));
vi.mock("@/lib/referenceEmails", () => ({
  sendRefereeInviteEmail: sendRefereeInviteEmailMock,
}));

async function importRoute() {
  return await import("../route");
}

function body(payload: unknown) {
  return new Request("http://localhost/api/hub/references/add-referee", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

describe("POST /api/hub/references/add-referee", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getActiveReferenceCheckIdMock.mockReset();
    addRefereeMock.mockReset();
    getCandidateDisplayNameMock.mockReset();
    createRefereeTokenMock.mockReset();
    sendRefereeInviteEmailMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(body({ name: "Jane", email: "jane@example.com", role: "manager" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await importRoute();
    const response = await POST(body({ name: "", email: "not-an-email", role: "manager" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when there is no active reference check", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getActiveReferenceCheckIdMock.mockResolvedValue(null);
    const { POST } = await importRoute();
    const response = await POST(body({ name: "Jane", email: "jane@example.com", role: "manager" }));
    expect(response.status).toBe(400);
  });

  it("adds the referee, creates a token, and sends the invite email", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getActiveReferenceCheckIdMock.mockResolvedValue("check-1");
    addRefereeMock.mockResolvedValue({ id: "referee-1" });
    getCandidateDisplayNameMock.mockResolvedValue("Alex Kumar");
    createRefereeTokenMock.mockResolvedValue("token-abc");
    sendRefereeInviteEmailMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const response = await POST(body({ name: "Jane", email: "jane@example.com", role: "manager" }));
    const responseBody = await response.json();

    expect(response.status).toBe(201);
    expect(responseBody).toEqual({ refereeId: "referee-1" });
    expect(addRefereeMock).toHaveBeenCalledWith("check-1", expect.objectContaining({ name: "Jane", email: "jane@example.com", role: "manager" }));
    expect(createRefereeTokenMock).toHaveBeenCalledWith("referee-1");
    expect(sendRefereeInviteEmailMock).toHaveBeenCalledWith({
      to: "jane@example.com",
      refereeName: "Jane",
      candidateName: "Alex Kumar",
      token: "token-abc",
    });
  });

  it("returns 409 when the referee cap is reached", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getActiveReferenceCheckIdMock.mockResolvedValue("check-1");
    addRefereeMock.mockRejectedValue(new Error("MAX_REFEREES_REACHED"));
    const { POST } = await importRoute();
    const response = await POST(body({ name: "Jane", email: "jane@example.com", role: "manager" }));
    expect(response.status).toBe(409);
  });
});
```

- [ ] **Step 3: Run both tests, confirm they fail**

Run: `npx vitest run app/api/hub/references/initiate/__tests__/route.test.ts app/api/hub/references/add-referee/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'` in both.

- [ ] **Step 4: Implement `initiate/route.ts`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\initiate\route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { initiateReferenceCheck } from "@/lib/referenceChecks";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const { id } = await initiateReferenceCheck(user.id);
    return Response.json({ checkId: id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_ACTIVE") {
      return Response.json({ error: "You already have an active reference check." }, { status: 409 });
    }
    return Response.json({ error: "Something went wrong starting your reference check." }, { status: 500 });
  }
}
```

- [ ] **Step 5: Implement `add-referee/route.ts`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\add-referee\route.ts`:

```ts
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { addReferee, getActiveReferenceCheckId, getCandidateDisplayName } from "@/lib/referenceChecks";
import { createRefereeToken } from "@/lib/referenceTokens";
import { sendRefereeInviteEmail } from "@/lib/referenceEmails";

const RefereeSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
  organization: z.string().trim().optional(),
  experienceLevel: z.enum(["fresher", "experienced"]).optional(),
  role: z.enum(["faculty", "classmate", "internship-colleague", "internship-manager", "manager", "team-lead", "teammate", "client", "other"]),
  customRole: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = RefereeSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Please check the referee details and try again." }, { status: 400 });
  }

  const checkId = await getActiveReferenceCheckId(user.id);
  if (!checkId) {
    return Response.json({ error: "Start a reference check before adding a referee." }, { status: 400 });
  }

  try {
    const { id: refereeId } = await addReferee(checkId, parsed.data);
    const candidateName = await getCandidateDisplayName(user.id);
    const token = await createRefereeToken(refereeId);
    await sendRefereeInviteEmail({ to: parsed.data.email, refereeName: parsed.data.name, candidateName, token });

    return Response.json({ refereeId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "MAX_REFEREES_REACHED") {
      return Response.json({ error: "You've reached the maximum of 10 referees." }, { status: 409 });
    }
    return Response.json({ error: "Something went wrong adding this referee." }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run both tests, confirm they pass**

Run: `npx vitest run app/api/hub/references/initiate/__tests__/route.test.ts app/api/hub/references/add-referee/__tests__/route.test.ts`
Expected: PASS (3 + 5 tests).

- [ ] **Step 7: Commit**

```bash
git add app/api/hub/references/initiate app/api/hub/references/add-referee
git commit -m "feat(hub): add initiate and add-referee reference-check routes"
```

---

### Task 6: `GET /api/hub/references/status`, `POST /api/hub/references/resend-invite`, `POST /api/hub/references/send-reminder`

**Files:**
- Create: `app/api/hub/references/status/route.ts`
- Create: `app/api/hub/references/resend-invite/route.ts`
- Create: `app/api/hub/references/send-reminder/route.ts`
- Test: `app/api/hub/references/status/__tests__/route.test.ts`
- Test: `app/api/hub/references/resend-invite/__tests__/route.test.ts`
- Test: `app/api/hub/references/send-reminder/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getReferenceCheckStatus`, `getRefereeForUser`, `incrementReminderCount`, `getCandidateDisplayName`, `MAX_REMINDERS` from `lib/referenceChecks.ts`; `createRefereeToken` from `lib/referenceTokens.ts`; `sendRefereeInviteEmail`, `sendRefereeReminderEmail` from `lib/referenceEmails.ts`.
- Produces: `GET /status` → `ReferenceCheckStatusResult | null` (200); `POST /resend-invite` and `POST /send-reminder` → `{ ok: true }` (200) or `{ error }` (401/400/404/409).

- [ ] **Step 1: Write the failing test for `status`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\status\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const getReferenceCheckStatusMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/referenceChecks", () => ({
  getReferenceCheckStatus: getReferenceCheckStatusMock,
}));

async function importRoute() {
  return await import("../route");
}

describe("GET /api/hub/references/status", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getReferenceCheckStatusMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns null when there is no reference check", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getReferenceCheckStatusMock.mockResolvedValue(null);
    const { GET } = await importRoute();
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toBeNull();
  });

  it("returns the check status", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const status = { checkId: "check-1", status: "in_progress", minReferences: 3, referees: [] };
    getReferenceCheckStatusMock.mockResolvedValue(status);
    const { GET } = await importRoute();
    const response = await GET();
    const body = await response.json();
    expect(body).toEqual(status);
  });
});
```

- [ ] **Step 2: Write the failing test for `resend-invite`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\resend-invite\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const getRefereeForUserMock = vi.fn();
const getCandidateDisplayNameMock = vi.fn();
const createRefereeTokenMock = vi.fn();
const sendRefereeInviteEmailMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/referenceChecks", () => ({
  getRefereeForUser: getRefereeForUserMock,
  getCandidateDisplayName: getCandidateDisplayNameMock,
}));
vi.mock("@/lib/referenceTokens", () => ({
  createRefereeToken: createRefereeTokenMock,
}));
vi.mock("@/lib/referenceEmails", () => ({
  sendRefereeInviteEmail: sendRefereeInviteEmailMock,
}));

async function importRoute() {
  return await import("../route");
}

function body(payload: unknown) {
  return new Request("http://localhost/api/hub/references/resend-invite", { method: "POST", body: JSON.stringify(payload) });
}

describe("POST /api/hub/references/resend-invite", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getRefereeForUserMock.mockReset();
    getCandidateDisplayNameMock.mockReset();
    createRefereeTokenMock.mockReset();
    sendRefereeInviteEmailMock.mockReset();
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the referee does not belong to this user", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue(null);
    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    expect(response.status).toBe(404);
  });

  it("resends the invite for a pending referee", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue({ id: "referee-1", name: "Jane", email: "jane@example.com", status: "pending", reminderCount: 0 });
    getCandidateDisplayNameMock.mockResolvedValue("Alex Kumar");
    createRefereeTokenMock.mockResolvedValue("token-new");
    sendRefereeInviteEmailMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ ok: true });
    expect(sendRefereeInviteEmailMock).toHaveBeenCalledWith({ to: "jane@example.com", refereeName: "Jane", candidateName: "Alex Kumar", token: "token-new" });
  });

  it("returns 409 when the referee already responded", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue({ id: "referee-1", name: "Jane", email: "jane@example.com", status: "completed", reminderCount: 0 });
    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    expect(response.status).toBe(409);
  });
});
```

- [ ] **Step 3: Write the failing test for `send-reminder`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\send-reminder\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const getRefereeForUserMock = vi.fn();
const getCandidateDisplayNameMock = vi.fn();
const createRefereeTokenMock = vi.fn();
const sendRefereeReminderEmailMock = vi.fn();
const incrementReminderCountMock = vi.fn();

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));
vi.mock("@/lib/referenceChecks", () => ({
  getRefereeForUser: getRefereeForUserMock,
  getCandidateDisplayName: getCandidateDisplayNameMock,
  incrementReminderCount: incrementReminderCountMock,
  MAX_REMINDERS: 3,
}));
vi.mock("@/lib/referenceTokens", () => ({
  createRefereeToken: createRefereeTokenMock,
}));
vi.mock("@/lib/referenceEmails", () => ({
  sendRefereeReminderEmail: sendRefereeReminderEmailMock,
}));

async function importRoute() {
  return await import("../route");
}

function body(payload: unknown) {
  return new Request("http://localhost/api/hub/references/send-reminder", { method: "POST", body: JSON.stringify(payload) });
}

describe("POST /api/hub/references/send-reminder", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getRefereeForUserMock.mockReset();
    getCandidateDisplayNameMock.mockReset();
    createRefereeTokenMock.mockReset();
    sendRefereeReminderEmailMock.mockReset();
    incrementReminderCountMock.mockReset();
  });

  it("returns 409 when the reminder cap is already reached", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue({ id: "referee-1", name: "Jane", email: "jane@example.com", status: "pending", reminderCount: 3 });
    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    expect(response.status).toBe(409);
    expect(incrementReminderCountMock).not.toHaveBeenCalled();
  });

  it("sends a reminder and increments the count", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getRefereeForUserMock.mockResolvedValue({ id: "referee-1", name: "Jane", email: "jane@example.com", status: "pending", reminderCount: 1 });
    getCandidateDisplayNameMock.mockResolvedValue("Alex Kumar");
    createRefereeTokenMock.mockResolvedValue("token-new");
    sendRefereeReminderEmailMock.mockResolvedValue(undefined);
    incrementReminderCountMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const response = await POST(body({ refereeId: "referee-1" }));
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ ok: true });
    expect(incrementReminderCountMock).toHaveBeenCalledWith("referee-1");
  });
});
```

- [ ] **Step 4: Run all three tests, confirm they fail**

Run: `npx vitest run app/api/hub/references/status/__tests__/route.test.ts app/api/hub/references/resend-invite/__tests__/route.test.ts app/api/hub/references/send-reminder/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'` in all three.

- [ ] **Step 5: Implement `status/route.ts`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\status\route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const status = await getReferenceCheckStatus(user.id);
  return Response.json(status);
}
```

- [ ] **Step 6: Implement `resend-invite/route.ts`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\resend-invite\route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getRefereeForUser, getCandidateDisplayName } from "@/lib/referenceChecks";
import { createRefereeToken } from "@/lib/referenceTokens";
import { sendRefereeInviteEmail } from "@/lib/referenceEmails";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { refereeId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.refereeId) {
    return Response.json({ error: "refereeId is required." }, { status: 400 });
  }

  const referee = await getRefereeForUser(user.id, body.refereeId);
  if (!referee) {
    return Response.json({ error: "Referee not found." }, { status: 404 });
  }
  if (referee.status !== "pending") {
    return Response.json({ error: "This referee has already responded." }, { status: 409 });
  }

  const candidateName = await getCandidateDisplayName(user.id);
  const token = await createRefereeToken(referee.id);
  await sendRefereeInviteEmail({ to: referee.email, refereeName: referee.name, candidateName, token });

  return Response.json({ ok: true });
}
```

- [ ] **Step 7: Implement `send-reminder/route.ts`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\send-reminder\route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getRefereeForUser, getCandidateDisplayName, incrementReminderCount, MAX_REMINDERS } from "@/lib/referenceChecks";
import { createRefereeToken } from "@/lib/referenceTokens";
import { sendRefereeReminderEmail } from "@/lib/referenceEmails";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { refereeId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.refereeId) {
    return Response.json({ error: "refereeId is required." }, { status: 400 });
  }

  const referee = await getRefereeForUser(user.id, body.refereeId);
  if (!referee) {
    return Response.json({ error: "Referee not found." }, { status: 404 });
  }
  if (referee.status !== "pending") {
    return Response.json({ error: "This referee has already responded." }, { status: 409 });
  }
  if (referee.reminderCount >= MAX_REMINDERS) {
    return Response.json({ error: "You've already sent the maximum number of reminders." }, { status: 409 });
  }

  const candidateName = await getCandidateDisplayName(user.id);
  const token = await createRefereeToken(referee.id);
  await sendRefereeReminderEmail({ to: referee.email, refereeName: referee.name, candidateName, token });
  await incrementReminderCount(referee.id);

  return Response.json({ ok: true });
}
```

- [ ] **Step 8: Run all three tests, confirm they pass**

Run: `npx vitest run app/api/hub/references/status/__tests__/route.test.ts app/api/hub/references/resend-invite/__tests__/route.test.ts app/api/hub/references/send-reminder/__tests__/route.test.ts`
Expected: PASS (3 + 4 + 2 tests).

- [ ] **Step 9: Commit**

```bash
git add app/api/hub/references/status app/api/hub/references/resend-invite app/api/hub/references/send-reminder
git commit -m "feat(hub): add reference-check status, resend-invite, send-reminder routes"
```

---

### Task 7: `GET`/`POST /api/hub/references/feedback/[token]` — public referee endpoint

**Files:**
- Create: `app/api/hub/references/feedback/[token]/route.ts`
- Test: `app/api/hub/references/feedback/[token]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `validateRefereeToken`, `consumeRefereeToken` from `lib/referenceTokens.ts`; `recordRefereeFeedback`, `recordRefereeDecline` from `lib/referenceChecks.ts`.
- Produces: `GET` → `{ refereeName, valid: true } | { valid: false, reason }` (200); `POST` → `{ ok: true }` (200) or `{ error }` (400/410).

- [ ] **Step 1: Write the failing tests**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\feedback\[token]\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const validateRefereeTokenMock = vi.fn();
const consumeRefereeTokenMock = vi.fn();
const recordRefereeFeedbackMock = vi.fn();
const recordRefereeDeclineMock = vi.fn();
const getRefereeNameMock = vi.fn();

vi.mock("@/lib/referenceTokens", () => ({
  validateRefereeToken: validateRefereeTokenMock,
  consumeRefereeToken: consumeRefereeTokenMock,
}));
vi.mock("@/lib/referenceChecks", () => ({
  recordRefereeFeedback: recordRefereeFeedbackMock,
  recordRefereeDecline: recordRefereeDeclineMock,
  getRefereeName: getRefereeNameMock,
}));

async function importRoute() {
  return await import("../route");
}

function params(token: string) {
  return { params: Promise.resolve({ token }) };
}

describe("GET /api/hub/references/feedback/[token]", () => {
  beforeEach(() => {
    validateRefereeTokenMock.mockReset();
    getRefereeNameMock.mockReset();
  });

  it("returns valid:false when the token is invalid", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: false, reason: "expired" });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost"), params("bad-token"));
    const body = await response.json();
    expect(body).toEqual({ valid: false, reason: "expired" });
  });

  it("returns the referee name when the token is valid", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: true, refereeId: "referee-1" });
    getRefereeNameMock.mockResolvedValue("Jane Doe");
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost"), params("good-token"));
    const body = await response.json();
    expect(body).toEqual({ valid: true, refereeName: "Jane Doe" });
  });
});

describe("POST /api/hub/references/feedback/[token]", () => {
  beforeEach(() => {
    validateRefereeTokenMock.mockReset();
    consumeRefereeTokenMock.mockReset();
    recordRefereeFeedbackMock.mockReset();
    recordRefereeDeclineMock.mockReset();
  });

  function body(payload: unknown) {
    return new Request("http://localhost", { method: "POST", body: JSON.stringify(payload) });
  }

  it("returns 410 when the token is not valid", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: false, reason: "used" });
    const { POST } = await importRoute();
    const response = await POST(body({ declined: true }), params("used-token"));
    expect(response.status).toBe(410);
  });

  it("records feedback and consumes the token", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: true, refereeId: "referee-1" });
    recordRefereeFeedbackMock.mockResolvedValue(undefined);
    consumeRefereeTokenMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const response = await POST(
      body({ ratings: [{ category: "teamwork", value: 5 }], overallFeedback: "Great." }),
      params("good-token")
    );
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ ok: true });
    expect(recordRefereeFeedbackMock).toHaveBeenCalledWith("referee-1", {
      ratings: [{ category: "teamwork", value: 5 }],
      overallFeedback: "Great.",
    });
    expect(consumeRefereeTokenMock).toHaveBeenCalledWith("good-token");
  });

  it("records a decline and consumes the token", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: true, refereeId: "referee-1" });
    recordRefereeDeclineMock.mockResolvedValue(undefined);
    consumeRefereeTokenMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const response = await POST(body({ declined: true }), params("good-token"));
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ ok: true });
    expect(recordRefereeDeclineMock).toHaveBeenCalledWith("referee-1");
    expect(consumeRefereeTokenMock).toHaveBeenCalledWith("good-token");
  });

  it("returns 400 when the body matches neither shape", async () => {
    validateRefereeTokenMock.mockResolvedValue({ valid: true, refereeId: "referee-1" });
    const { POST } = await importRoute();
    const response = await POST(body({}), params("good-token"));
    expect(response.status).toBe(400);
    expect(consumeRefereeTokenMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run "app/api/hub/references/feedback/[token]/__tests__/route.test.ts"`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Add `getRefereeName` to `lib/referenceChecks.ts`**

Modify `d:\Work-Projects\merito-website-v2\lib\referenceChecks.ts` — append this export (used only by the public feedback route, which must not be able to read anything else about the referee row):

```ts
export async function getRefereeName(refereeId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("referees").select("name").eq("id", refereeId).maybeSingle();
  return data?.name ?? null;
}
```

- [ ] **Step 4: Implement `feedback/[token]/route.ts`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\feedback\[token]\route.ts`:

```ts
import { z } from "zod";
import { validateRefereeToken, consumeRefereeToken } from "@/lib/referenceTokens";
import { recordRefereeFeedback, recordRefereeDecline, getRefereeName } from "@/lib/referenceChecks";

const FEEDBACK_CATEGORIES = [
  "knowledge-application",
  "initiative",
  "teamwork",
  "communication",
  "discipline",
  "problem-solving",
  "leadership-skills",
] as const;

const SubmitFeedbackSchema = z.object({
  ratings: z
    .array(z.object({ category: z.enum(FEEDBACK_CATEGORIES), value: z.number().int().min(1).max(5) }))
    .length(FEEDBACK_CATEGORIES.length),
  overallFeedback: z.string().trim().min(1),
});

const DeclineSchema = z.object({ declined: z.literal(true) });

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params;
  const validation = await validateRefereeToken(token);

  if (!validation.valid) {
    return Response.json({ valid: false, reason: validation.reason });
  }

  const refereeName = await getRefereeName(validation.refereeId);
  return Response.json({ valid: true, refereeName });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { token } = await params;
  const validation = await validateRefereeToken(token);

  if (!validation.valid) {
    return Response.json({ error: "This link is no longer valid." }, { status: 410 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const decline = DeclineSchema.safeParse(json);
  if (decline.success) {
    await recordRefereeDecline(validation.refereeId);
    await consumeRefereeToken(token);
    return Response.json({ ok: true });
  }

  const feedback = SubmitFeedbackSchema.safeParse(json);
  if (feedback.success) {
    await recordRefereeFeedback(validation.refereeId, feedback.data);
    await consumeRefereeToken(token);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Please provide ratings for all categories, or decline." }, { status: 400 });
}
```

- [ ] **Step 5: Run tests, confirm they pass**

Run: `npx vitest run "app/api/hub/references/feedback/[token]/__tests__/route.test.ts"`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/referenceChecks.ts app/api/hub/references/feedback
git commit -m "feat(hub): add public referee feedback/decline route"
```

---

### Task 8: `POST /api/hub/references/reminder-sweep` — cron endpoint + Vercel Cron config

**Files:**
- Create: `app/api/hub/references/reminder-sweep/route.ts`
- Create: `vercel.json`
- Test: `app/api/hub/references/reminder-sweep/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getStaleRefereesForReminder`, `incrementReminderCount`, `getCandidateDisplayName` from `lib/referenceChecks.ts`; needs the referee's `reference_check_id` → `user_id` to build the candidate name and feedback link, so this task also adds `getReferenceCheckOwner(checkId: string): Promise<string | null>` to `lib/referenceChecks.ts`; `createRefereeToken` from `lib/referenceTokens.ts`; `sendRefereeReminderEmail` from `lib/referenceEmails.ts`.
- Produces: `POST /api/hub/references/reminder-sweep` → `{ remindersSent: number }` (200) or `{ error }` (401).

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\reminder-sweep\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getStaleRefereesForReminderMock = vi.fn();
const getReferenceCheckOwnerMock = vi.fn();
const getCandidateDisplayNameMock = vi.fn();
const incrementReminderCountMock = vi.fn();
const createRefereeTokenMock = vi.fn();
const sendRefereeReminderEmailMock = vi.fn();

vi.mock("@/lib/referenceChecks", () => ({
  getStaleRefereesForReminder: getStaleRefereesForReminderMock,
  getReferenceCheckOwner: getReferenceCheckOwnerMock,
  getCandidateDisplayName: getCandidateDisplayNameMock,
  incrementReminderCount: incrementReminderCountMock,
}));
vi.mock("@/lib/referenceTokens", () => ({
  createRefereeToken: createRefereeTokenMock,
}));
vi.mock("@/lib/referenceEmails", () => ({
  sendRefereeReminderEmail: sendRefereeReminderEmailMock,
}));

const ORIGINAL_ENV = { ...process.env };

async function importRoute() {
  return await import("../route");
}

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/hub/references/reminder-sweep", { method: "POST", headers });
}

describe("POST /api/hub/references/reminder-sweep", () => {
  beforeEach(() => {
    getStaleRefereesForReminderMock.mockReset();
    getReferenceCheckOwnerMock.mockReset();
    getCandidateDisplayNameMock.mockReset();
    incrementReminderCountMock.mockReset();
    createRefereeTokenMock.mockReset();
    sendRefereeReminderEmailMock.mockReset();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "sekret" };
  });

  it("returns 401 when the bearer token doesn't match CRON_SECRET", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ authorization: "Bearer wrong" }));
    expect(response.status).toBe(401);
    expect(getStaleRefereesForReminderMock).not.toHaveBeenCalled();
  });

  it("sends a reminder to each stale referee and reports the count", async () => {
    getStaleRefereesForReminderMock.mockResolvedValue([
      { id: "referee-1", name: "Jane", email: "jane@example.com", reference_check_id: "check-1" },
      { id: "referee-2", name: "Sam", email: "sam@example.com", reference_check_id: "check-2" },
    ]);
    getReferenceCheckOwnerMock.mockImplementation(async (checkId: string) => (checkId === "check-1" ? "user-1" : "user-2"));
    getCandidateDisplayNameMock.mockResolvedValue("Alex Kumar");
    createRefereeTokenMock.mockResolvedValue("token-x");
    sendRefereeReminderEmailMock.mockResolvedValue(undefined);
    incrementReminderCountMock.mockResolvedValue(undefined);

    const { POST } = await importRoute();
    const response = await POST(request({ authorization: "Bearer sekret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ remindersSent: 2 });
    expect(sendRefereeReminderEmailMock).toHaveBeenCalledTimes(2);
    expect(incrementReminderCountMock).toHaveBeenCalledWith("referee-1");
    expect(incrementReminderCountMock).toHaveBeenCalledWith("referee-2");
  });

  it("skips a referee whose check owner can't be resolved, without failing the sweep", async () => {
    getStaleRefereesForReminderMock.mockResolvedValue([{ id: "referee-1", name: "Jane", email: "jane@example.com", reference_check_id: "check-1" }]);
    getReferenceCheckOwnerMock.mockResolvedValue(null);

    const { POST } = await importRoute();
    const response = await POST(request({ authorization: "Bearer sekret" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ remindersSent: 0 });
    expect(sendRefereeReminderEmailMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

Run: `npx vitest run app/api/hub/references/reminder-sweep/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Add `getReferenceCheckOwner` to `lib/referenceChecks.ts`**

Modify `d:\Work-Projects\merito-website-v2\lib\referenceChecks.ts` — append this export:

```ts
export async function getReferenceCheckOwner(checkId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("reference_checks").select("user_id").eq("id", checkId).maybeSingle();
  return data?.user_id ?? null;
}
```

- [ ] **Step 4: Implement `reminder-sweep/route.ts`**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\references\reminder-sweep\route.ts`:

```ts
import { getStaleRefereesForReminder, getReferenceCheckOwner, getCandidateDisplayName, incrementReminderCount } from "@/lib/referenceChecks";
import { createRefereeToken } from "@/lib/referenceTokens";
import { sendRefereeReminderEmail } from "@/lib/referenceEmails";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!expected || authorization !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const stale = await getStaleRefereesForReminder();
  let remindersSent = 0;

  for (const referee of stale) {
    const ownerId = await getReferenceCheckOwner(referee.reference_check_id);
    if (!ownerId) continue;

    const candidateName = await getCandidateDisplayName(ownerId);
    const token = await createRefereeToken(referee.id);
    await sendRefereeReminderEmail({ to: referee.email, refereeName: referee.name, candidateName, token });
    await incrementReminderCount(referee.id);
    remindersSent++;
  }

  return Response.json({ remindersSent });
}
```

- [ ] **Step 5: Add the Vercel Cron config**

Create `d:\Work-Projects\merito-website-v2\vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/hub/references/reminder-sweep",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Vercel Cron sends its own `Authorization: Bearer $CRON_SECRET` header automatically when `CRON_SECRET` is set as a project environment variable — no extra wiring needed beyond the env var already added in Task 1. Note in your task report that `CRON_SECRET` must be set in the Vercel project settings (not just `.env.example`) for this to work in production.

- [ ] **Step 6: Run test, confirm it passes**

Run: `npx vitest run app/api/hub/references/reminder-sweep/__tests__/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/referenceChecks.ts app/api/hub/references/reminder-sweep vercel.json
git commit -m "feat(hub): add reference-check reminder sweep cron job"
```

---

### Task 9: Candidate-facing UI — `app/hub/account/references/page.tsx`

**Files:**
- Create: `app/hub/account/references/page.tsx`
- Create: `app/hub/account/references/ReferencesClient.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient` from `lib/supabaseAuthServer.ts`; fetches from `GET /api/hub/references/status`, posts to `POST /api/hub/references/initiate`, `POST /api/hub/references/add-referee`, `POST /api/hub/references/resend-invite`, `POST /api/hub/references/send-reminder` (all defined in Tasks 5–6).
- Produces: the `/hub/account/references` route.

- [ ] **Step 1: Implement the server component**

Create `d:\Work-Projects\merito-website-v2\app\hub\account\references\page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";
import ReferencesClient from "./ReferencesClient";

export default async function ReferencesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const status = await getReferenceCheckStatus(user.id);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px" }}>
      <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>
        Reference checks
      </h1>
      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, margin: "0 0 24px" }}>
        Invite people who&apos;ve worked with you to rate you across 7 categories. 3 completed references unlock this step.
      </p>
      <ReferencesClient initialStatus={status} />
    </main>
  );
}
```

- [ ] **Step 2: Implement the client component**

Create `d:\Work-Projects\merito-website-v2\app\hub\account\references\ReferencesClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ReferenceCheckStatusResult, RefereeRole } from "@/lib/referenceChecks";

const ROLE_OPTIONS: { value: RefereeRole; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "team-lead", label: "Team lead" },
  { value: "teammate", label: "Teammate" },
  { value: "client", label: "Client" },
  { value: "faculty", label: "Faculty" },
  { value: "classmate", label: "Classmate" },
  { value: "internship-manager", label: "Internship manager" },
  { value: "internship-colleague", label: "Internship colleague" },
  { value: "other", label: "Other" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  rejected: "Declined",
};

export default function ReferencesClient({ initialStatus }: { initialStatus: ReferenceCheckStatusResult | null }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "manager" as RefereeRole, organization: "" });

  async function refreshStatus() {
    const res = await fetch("/api/hub/references/status");
    if (res.ok) {
      setStatus(await res.json());
    }
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/hub/references/initiate", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    await refreshStatus();
  }

  async function handleAddReferee(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/hub/references/add-referee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setForm({ name: "", email: "", role: "manager", organization: "" });
    await refreshStatus();
  }

  async function handleResend(refereeId: string, kind: "resend-invite" | "send-reminder") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/hub/references/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refereeId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    await refreshStatus();
  }

  if (!status) {
    return (
      <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 20, padding: 24 }}>
        <button
          onClick={handleStart}
          disabled={busy}
          className="font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ height: 46, padding: "0 20px", borderRadius: 8, background: busy ? "#dcdcdc" : "#ed1a24", border: "none", cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "Starting…" : "Start my reference check"}
        </button>
        {error && <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10 }}>{error}</p>}
      </div>
    );
  }

  const completedCount = status.referees.filter((r) => r.status === "completed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 20, padding: 24 }}>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: "0 0 12px" }}>
          {completedCount} of {status.minReferences} completed — status: {status.status}
        </p>
        {status.referees.map((referee) => (
          <div
            key={referee.id}
            className="flex items-center"
            style={{ gap: 10, padding: "10px 0", borderTop: "1px solid #f0e6ea" }}
          >
            <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, flex: 1 }}>
              {referee.name} ({referee.email})
            </span>
            <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12 }}>
              {STATUS_LABEL[referee.status]}
            </span>
            {referee.status === "pending" && (
              <>
                <button
                  onClick={() => handleResend(referee.id, "resend-invite")}
                  disabled={busy}
                  style={{ fontSize: 12, background: "none", border: "1px solid #dcdcdc", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
                >
                  Resend
                </button>
                <button
                  onClick={() => handleResend(referee.id, "send-reminder")}
                  disabled={busy || referee.reminder_count >= 3}
                  style={{ fontSize: 12, background: "none", border: "1px solid #dcdcdc", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
                >
                  Remind ({referee.reminder_count}/3)
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {status.referees.length < 10 && (
        <form onSubmit={handleAddReferee} className="bg-white border border-black/[0.08]" style={{ borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            placeholder="Referee name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            style={{ height: 42, borderRadius: 8, border: "1px solid #dcdcdc", padding: "0 12px", fontSize: 13 }}
          />
          <input
            placeholder="Referee email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            style={{ height: 42, borderRadius: 8, border: "1px solid #dcdcdc", padding: "0 12px", fontSize: 13 }}
          />
          <input
            placeholder="Organization (optional)"
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            style={{ height: 42, borderRadius: 8, border: "1px solid #dcdcdc", padding: "0 12px", fontSize: 13 }}
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as RefereeRole })}
            style={{ height: 42, borderRadius: 8, border: "1px solid #dcdcdc", padding: "0 12px", fontSize: 13 }}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ height: 46, borderRadius: 8, background: busy ? "#dcdcdc" : "#ed1a24", border: "none", cursor: busy ? "default" : "pointer" }}
          >
            {busy ? "Adding…" : "Add referee"}
          </button>
        </form>
      )}

      {error && <p style={{ fontSize: 12.5, color: "#ed1a24" }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

No component test infra exists in this repo (per Global Constraints). Run `npm run dev`, sign in at `/hub/login`, navigate to `/hub/account/references`, and manually verify: "Start my reference check" creates a check, the add-referee form adds a row, resend/remind buttons call their routes without throwing (check the Network tab — actual email delivery requires `RESEND_API_KEY` to be set).

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/references
git commit -m "feat(hub): add candidate-facing reference-checks dashboard page"
```

---

### Task 10: Public referee UI — `app/hub/references/feedback/[token]/page.tsx`

**Files:**
- Create: `app/hub/references/feedback/[token]/page.tsx`
- Create: `app/hub/references/feedback/[token]/FeedbackForm.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/hub/references/feedback/[token]` (Task 7).
- Produces: the public `/hub/references/feedback/[token]` route.

- [ ] **Step 1: Implement the server component**

Create `d:\Work-Projects\merito-website-v2\app\hub\references\feedback\[token]\page.tsx`:

```tsx
import FeedbackForm from "./FeedbackForm";

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
      <FeedbackForm token={token} />
    </main>
  );
}
```

- [ ] **Step 2: Implement the client form component**

Create `d:\Work-Projects\merito-website-v2\app\hub\references\feedback\[token]\FeedbackForm.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "knowledge-application", label: "Knowledge application" },
  { value: "initiative", label: "Initiative" },
  { value: "teamwork", label: "Teamwork" },
  { value: "communication", label: "Communication" },
  { value: "discipline", label: "Discipline" },
  { value: "problem-solving", label: "Problem-solving" },
  { value: "leadership-skills", label: "Leadership skills" },
];

type LoadState =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "ready"; refereeName: string }
  | { kind: "submitted" };

export default function FeedbackForm({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [overallFeedback, setOverallFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/hub/references/feedback/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setState({ kind: "ready", refereeName: data.refereeName });
        } else {
          setState({ kind: "invalid", reason: data.reason });
        }
      })
      .catch(() => setState({ kind: "invalid", reason: "not_found" }));
  }, [token]);

  async function submit(payload: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/hub/references/feedback/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setState({ kind: "submitted" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ratingsList = CATEGORIES.map((c) => ({ category: c.value, value: ratings[c.value] }));
    if (ratingsList.some((r) => !r.value)) {
      setError("Please rate every category.");
      return;
    }
    await submit({ ratings: ratingsList, overallFeedback });
  }

  async function handleDecline() {
    await submit({ declined: true });
  }

  if (state.kind === "loading") return <p>Loading…</p>;
  if (state.kind === "invalid") {
    const messages: Record<string, string> = {
      not_found: "This feedback link isn't valid.",
      expired: "This feedback link has expired.",
      used: "This feedback link has already been used.",
    };
    return <p>{messages[state.reason] || "This feedback link isn't valid."}</p>;
  }
  if (state.kind === "submitted") return <p>Thanks — your feedback has been recorded.</p>;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem" }}>
        Rate {state.refereeName}
      </h1>
      {CATEGORIES.map((cat) => (
        <div key={cat.value} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13 }}>{cat.label}</span>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setRatings({ ...ratings, [cat.value]: value })}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid #dcdcdc",
                background: ratings[cat.value] === value ? "#ed1a24" : "white",
                color: ratings[cat.value] === value ? "white" : "black",
                cursor: "pointer",
              }}
            >
              {value}
            </button>
          ))}
        </div>
      ))}
      <textarea
        placeholder="Overall feedback"
        value={overallFeedback}
        onChange={(e) => setOverallFeedback(e.target.value)}
        required
        style={{ minHeight: 100, borderRadius: 8, border: "1px solid #dcdcdc", padding: 12, fontSize: 13 }}
      />
      {error && <p style={{ fontSize: 12.5, color: "#ed1a24" }}>{error}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={busy}
          style={{ flex: 1, height: 46, borderRadius: 8, background: busy ? "#dcdcdc" : "#ed1a24", color: "white", border: "none", cursor: busy ? "default" : "pointer" }}
        >
          Submit
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={busy}
          style={{ height: 46, padding: "0 16px", borderRadius: 8, background: "white", border: "1px solid #dcdcdc", cursor: busy ? "default" : "pointer" }}
        >
          I can't do this
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`. Use a real token created via the flow in Task 9 (or insert a `reference_tokens` row by hand against a dev Supabase project) and visit `/hub/references/feedback/<token>`. Verify: valid token shows the rating form; submitting all 7 ratings + text succeeds and shows the "Thanks" message; visiting the same URL again shows "already been used" (token is single-use); an unknown token shows "isn't valid".

- [ ] **Step 4: Commit**

```bash
git add app/hub/references/feedback
git commit -m "feat(hub): add public referee feedback form"
```

---

### Task 11: Wire `ProgressRail` to real reference-check status

**Files:**
- Modify: `app/hub/account/ProgressRail.tsx`
- Modify: `app/hub/account/DashboardClient.tsx`
- Modify: `app/hub/account/page.tsx`

**Interfaces:**
- Consumes: `getReferenceCheckStatus` from `lib/referenceChecks.ts`.
- Produces: `ProgressRail` gains a `referenceCheckStatus: "none" | "in_progress" | "completed"` prop and links the row to `/hub/account/references`; `references` leaves the `isComingSoon` set.

- [ ] **Step 1: Update `ProgressRail.tsx`**

Modify `d:\Work-Projects\merito-website-v2\app\hub\account\ProgressRail.tsx`. Replace the whole file:

```tsx
"use client";

import Link from "next/link";

const STEPS = [
  { key: "score", label: "Job fitment score" },
  { key: "report", label: "Detailed report" },
  { key: "personality", label: "Personality test" },
  { key: "references", label: "Reference checks" },
  { key: "interview", label: "Mock AI interview" },
] as const;

export default function ProgressRail({
  reportUnlocked,
  referenceCheckStatus,
  onOpenReportPaywall,
}: {
  reportUnlocked: boolean;
  referenceCheckStatus: "none" | "in_progress" | "completed";
  onOpenReportPaywall: () => void;
}) {
  const referencesDone = referenceCheckStatus === "completed";
  const doneCount = 1 + (reportUnlocked ? 1 : 0) + (referencesDone ? 1 : 0);
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
          const isDone = step.key === "score" || (step.key === "report" && reportUnlocked) || (step.key === "references" && referencesDone);
          const isReportLocked = step.key === "report" && !reportUnlocked;
          const isReferencesActive = step.key === "references";
          const isComingSoon = step.key === "personality" || step.key === "interview";

          const rowContent = (
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
              {isReferencesActive && !referencesDone && referenceCheckStatus === "in_progress" && (
                <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11 }}>
                  In progress
                </span>
              )}
            </>
          );

          const rowStyle = {
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 12,
            minHeight: 44,
            cursor: isReportLocked || isReferencesActive ? "pointer" : "default",
            borderLeft: isReportLocked ? "5px solid #ed1a24" : "5px solid transparent",
          } as const;
          const rowClassName = isDone ? "bg-[#eefdf1]" : isReportLocked ? "bg-[#fdf8fb]" : "bg-white";

          if (isReferencesActive) {
            return (
              <Link key={step.key} href="/hub/account/references" className={rowClassName} style={rowStyle}>
                {rowContent}
              </Link>
            );
          }

          return (
            <div key={step.key} onClick={isReportLocked ? onOpenReportPaywall : undefined} className={rowClassName} style={rowStyle}>
              {rowContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `DashboardClient.tsx`**

Modify `d:\Work-Projects\merito-website-v2\app\hub\account\DashboardClient.tsx:11-38` — add a `referenceCheckStatus` prop and pass it through:

```tsx
export default function DashboardClient({
  roleTitle,
  score,
  prevScore,
  verdict,
  initialReportUnlocked,
  initialReport,
  referenceCheckStatus,
}: {
  roleTitle: string;
  score: number;
  prevScore: number | null;
  verdict: string;
  initialReportUnlocked: boolean;
  initialReport: FitmentReportResult | null;
  referenceCheckStatus: "none" | "in_progress" | "completed";
}) {
  const [modal, setModal] = useState<"none" | "report" | "changeRole">("none");
  const [reportUnlocked, setReportUnlocked] = useState(initialReportUnlocked);
  const [report, setReport] = useState<FitmentReportResult | null>(initialReport);

  return (
    <>
      <TopBar roleTitle={roleTitle} onChangeRole={() => setModal("changeRole")} />

      <div
        className="mx-auto"
        style={{ maxWidth: 1440, padding: 24, display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 22 }}
      >
        <ProgressRail reportUnlocked={reportUnlocked} referenceCheckStatus={referenceCheckStatus} onOpenReportPaywall={() => setModal("report")} />
```

Leave everything below that line (the rest of the JSX) unchanged.

- [ ] **Step 3: Update `account/page.tsx`**

Modify `d:\Work-Projects\merito-website-v2\app\hub\account\page.tsx` — add the reference-check status fetch and pass it to `DashboardClient`:

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";
import DashboardClient from "./DashboardClient";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";

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
  const referenceCheck = await getReferenceCheckStatus(user.id);
  const referenceCheckStatus: "none" | "in_progress" | "completed" =
    !referenceCheck ? "none" : referenceCheck.status === "completed" ? "completed" : "in_progress";

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

  return (
    <DashboardClient
      roleTitle={current.role_title}
      score={current.score}
      prevScore={prevForSameRole ? prevForSameRole.score : null}
      verdict={current.verdict}
      initialReportUnlocked={reportUnlocked}
      initialReport={report}
      referenceCheckStatus={referenceCheckStatus}
    />
  );
}
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`, sign in, visit `/hub/account`. Verify: with no reference check started, the "Reference checks" row shows unchecked and links to `/hub/account/references`; after starting a check and completing 3 referees (via Tasks 9–10's flow against a dev Supabase project), the row shows a green checkmark and the completed-steps counter increments.

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/ProgressRail.tsx app/hub/account/DashboardClient.tsx app/hub/account/page.tsx
git commit -m "feat(hub): wire reference-check status into the dashboard progress rail"
```

---

### Task 12: Marketing copy correction — `app/hub/page.tsx`

**Files:**
- Modify: `app/hub/page.tsx`

**Interfaces:**
- None — copy-only change.

- [ ] **Step 1: Fix the parameter count in the References Feedback offering**

Modify `d:\Work-Projects\merito-website-v2\app\hub\page.tsx` around line 43 — the `OFFERINGS` array's `n: "4"` entry currently reads:

```
body: "Invite managers, teammates, or clients to rate your soft skills across 5–6 parameters. Verified, structured references that carry the kind of credibility a CV never can.",
```

Replace with:

```
body: "Invite managers, teammates, or clients to rate your soft skills across 7 parameters. Verified, structured references that carry the kind of credibility a CV never can.",
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, visit `/hub`, scroll to the offerings grid, confirm the "References Feedback" card reads "across 7 parameters".

- [ ] **Step 3: Commit**

```bash
git add app/hub/page.tsx
git commit -m "fix(hub): correct reference-checks parameter count in marketing copy"
```

---

## Self-Review Notes

- **Spec coverage:** every spec section maps to a task — data model (Task 1), tokens (Task 2), email (Task 3), core logic (Task 4), all 7 API routes (Tasks 5–8), both UI pages (Tasks 9–10), `ProgressRail` wiring (Task 11), copy fix (Task 12).
- **Gap found and fixed during planning:** the spec's schema sketch had no way to pace reminders (no last-sent timestamp). Added `referees.last_reminded_at` in Task 1 and `getStaleRefereesForReminder`/`REMINDER_INTERVAL_DAYS` in Task 4 — called out in Global Constraints as a deviation from the spec's literal schema block, not a silent one.
- **Type consistency checked:** `RefereeRole`, `RefereeInput`, `ReferenceCheckStatusResult`, `RefereeRow`, `RefereeForUser`, and the 7 `FEEDBACK_CATEGORIES` values are defined once (Task 4 / Task 7) and referenced identically by name in every later task that consumes them (Tasks 5, 6, 9, 11).
