# Merito HUB — Phase 0: Fitment Check & Lead Capture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake client-side fitment score in `app/hub/FitmentChecker.tsx` with a real flow: visitor submits role + JD + CV + email → server verifies reCAPTCHA, rate-limits by email, parses the CV in memory, scores it against the JD via Claude Haiku 4.5, stores the result (never the CV) in Supabase, and returns a real score to the UI.

**Architecture:** One new Next.js Route Handler (`app/api/hub/fitment-check/route.ts`) in the existing app — no new service, no new deployment. Supabase Postgres holds one new table, `fitment_leads`. CV→text extraction and Claude scoring are both small, independently testable library functions. Two existing pieces of logic in `app/api/contact/route.ts` (reCAPTCHA verification, in-memory rate limiting) are extracted into shared `lib/` modules first, so the new route reuses them instead of duplicating them — this also cleans up the file this plan touches.

**Tech Stack:** Next.js 16 App Router (existing), TypeScript, Supabase (`@supabase/supabase-js`), Anthropic API (`@anthropic-ai/sdk` + `zod` for structured output), `pdf-parse` + `mammoth` for CV text extraction, Vitest for tests (new — no test runner exists in this repo yet).

## Global Constraints

- No CV content (file or extracted text) is ever written to a database, disk, or log — it is parsed in memory inside the route handler and discarded after the Claude call returns. This is a hard requirement from the spec, not a style preference.
- The `fitment_leads` table has no CV column of any kind.
- Every new server-side module goes in `lib/`, matching the existing `lib/site.ts` convention (flat, one file per concern).
- Match existing code style exactly: double quotes, no semicolon-free style, `Response.json({...}, {status})` for API responses (see `app/api/contact/route.ts`), Tailwind arbitrary-value className strings for UI (see `app/hub/FitmentChecker.tsx`).
- `docs/` is gitignored in this repo (confirmed via `.gitignore:54`) — this plan and its spec live in `plans/` and `specs/` instead, which are tracked normally.
- Never use `git add -A`; stage files explicitly.

---

### Task 1: Add Vitest test runner

No test framework exists in this repo (`package.json` has no `test` script, no `vitest.config.ts`/`jest.config.*`). Every later task needs to run tests, so this is first.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Test: `lib/__tests__/setup.test.ts`

**Interfaces:**
- Produces: `npm test` runs Vitest once (CI-style, non-watch) across `**/*.test.ts`.

- [ ] **Step 1: Install Vitest**

Run:
```
npm install -D vitest
```
Expected: `package.json` gains `"vitest"` under `devDependencies`.

- [ ] **Step 2: Create the Vitest config**

Create `d:\Work-Projects\merito-website-v2\vitest.config.ts`. The repo's `tsconfig.json` defines a `@/*` path alias (used throughout, e.g. `import { getAbsoluteUrl } from "@/lib/site"`) — Vitest does not read `tsconfig.json` `paths` automatically, so the alias is configured explicitly here or every `@/lib/...` import (including the mocks in Task 7) fails to resolve at test time:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
```

- [ ] **Step 3: Add the `test` script**

In `d:\Work-Projects\merito-website-v2\package.json`, inside `"scripts"`, add a `test` entry alongside the existing ones:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Write a trivial setup test**

Create `d:\Work-Projects\merito-website-v2\lib\__tests__\setup.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest setup", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: `1 passed` (the `vitest setup > runs` test), exit code 0.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json lib/__tests__/setup.test.ts
git commit -m "test: add Vitest test runner"
```

---

### Task 2: Extract shared reCAPTCHA verification into `lib/recaptcha.ts`

`app/api/contact/route.ts:50-69` already defines `verifyRecaptchaToken`. The new fitment-check route needs the identical function — extract it once, use it from both places, instead of duplicating it.

**Files:**
- Create: `lib/recaptcha.ts`
- Modify: `app/api/contact/route.ts`
- Test: `lib/__tests__/recaptcha.test.ts`

**Interfaces:**
- Produces: `verifyRecaptchaToken(token: string, secret: string): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\__tests__\recaptcha.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyRecaptchaToken } from "../recaptcha";

describe("verifyRecaptchaToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when Google reports success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
    );
    const result = await verifyRecaptchaToken("good-token", "secret");
    expect(result).toBe(true);
  });

  it("returns false when Google reports failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      })
    );
    const result = await verifyRecaptchaToken("bad-token", "secret");
    expect(result).toBe(false);
  });

  it("returns false when the request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    );
    const result = await verifyRecaptchaToken("token", "secret");
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/__tests__/recaptcha.test.ts`
Expected: FAIL — `Cannot find module '../recaptcha'` (or similar resolution error), because `lib/recaptcha.ts` doesn't exist yet.

- [ ] **Step 3: Create `lib/recaptcha.ts`**

Create `d:\Work-Projects\merito-website-v2\lib\recaptcha.ts` — this is `app/api/contact/route.ts:50-69` moved verbatim into a shared module:

```ts
export async function verifyRecaptchaToken(token: string, secret: string) {
  const verificationResponse = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret,
      response: token,
    }),
    cache: "no-store",
  });

  if (!verificationResponse.ok) {
    return false;
  }

  const verificationData = (await verificationResponse.json()) as { success?: boolean };
  return Boolean(verificationData.success);
}
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `npm test -- lib/__tests__/recaptcha.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Update `app/api/contact/route.ts` to use the shared function**

In `d:\Work-Projects\merito-website-v2\app\api\contact\route.ts`, add the import at the top of the file (after the existing `import { Resend } from "resend";`):

```ts
import { Resend } from "resend";
import { verifyRecaptchaToken } from "@/lib/recaptcha";
```

Then delete the now-duplicate local definition — remove this whole block (currently lines 50-69):

```ts
async function verifyRecaptchaToken(token: string, secret: string) {
  const verificationResponse = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret,
      response: token,
    }),
    cache: "no-store",
  });

  if (!verificationResponse.ok) {
    return false;
  }

  const verificationData = (await verificationResponse.json()) as { success?: boolean };
  return Boolean(verificationData.success);
}
```

The rest of `app/api/contact/route.ts` (the `POST` handler that calls `verifyRecaptchaToken(recaptchaToken, recaptchaSecretKey as string)`) is unchanged — it now resolves to the imported function.

- [ ] **Step 6: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint app/api/contact/route.ts lib/recaptcha.ts`
Expected: no output, exit code 0.

- [ ] **Step 7: Manually verify the contact form still works**

Run: `npm run dev` (in the background), then:
```
curl -s -X POST http://localhost:3000/api/contact -H "Content-Type: application/json" -d '{}'
```
Expected: `{"error":"Missing required fields."}` — same 400 behavior as before the refactor (confirms the route still loads and runs; reCAPTCHA is skipped here since `RECAPTCHA_SECRET_KEY` isn't set in local dev unless configured).

- [ ] **Step 8: Commit**

```bash
git add lib/recaptcha.ts lib/__tests__/recaptcha.test.ts app/api/contact/route.ts
git commit -m "refactor: extract shared reCAPTCHA verification into lib/recaptcha.ts"
```

---

### Task 3: Extract shared rate limiter into `lib/rateLimit.ts`

`app/api/contact/route.ts:3-19` has an inline per-IP rate limiter. The fitment-check route needs the same mechanism but keyed by **email** instead of IP. Extract a small factory so both routes share one implementation.

**Files:**
- Create: `lib/rateLimit.ts`
- Modify: `app/api/contact/route.ts`
- Test: `lib/__tests__/rateLimit.test.ts`

**Interfaces:**
- Produces: `createRateLimiter(options: { max: number; windowMs: number }): (key: string) => boolean` — returns `true` if the call is allowed (and records it), `false` if the key is over its limit for the current window.

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\__tests__\rateLimit.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRateLimiter } from "../rateLimit";

describe("createRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows calls under the max", () => {
    const check = createRateLimiter({ max: 2, windowMs: 1000 });
    expect(check("a@example.com")).toBe(true);
    expect(check("a@example.com")).toBe(true);
  });

  it("blocks calls over the max within the window", () => {
    const check = createRateLimiter({ max: 2, windowMs: 1000 });
    check("a@example.com");
    check("a@example.com");
    expect(check("a@example.com")).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const check = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(check("a@example.com")).toBe(true);
    expect(check("b@example.com")).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const check = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(check("a@example.com")).toBe(true);
    expect(check("a@example.com")).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(check("a@example.com")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/__tests__/rateLimit.test.ts`
Expected: FAIL — `Cannot find module '../rateLimit'`.

- [ ] **Step 3: Create `lib/rateLimit.ts`**

Create `d:\Work-Projects\merito-website-v2\lib\rateLimit.ts` — generalizes the `rateLimitMap`/`checkRateLimit` pattern from `app/api/contact/route.ts:3-19` into a factory keyed by an arbitrary string:

```ts
type RateLimitOptions = {
  max: number;
  windowMs: number;
};

export function createRateLimiter({ max, windowMs }: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string): boolean {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
  };
}
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `npm test -- lib/__tests__/rateLimit.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: Update `app/api/contact/route.ts` to use the shared factory**

In `d:\Work-Projects\merito-website-v2\app\api\contact\route.ts`, replace this block (currently lines 1-20):

```ts
import { Resend } from "resend";

// --- Simple in-memory rate limiter ---
// Per-instance (sufficient for single deployments; for multi-instance Vercel, swap to KV)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}
// -------------------------------------
```

with:

```ts
import { Resend } from "resend";
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { createRateLimiter } from "@/lib/rateLimit";

// Per-instance (sufficient for single deployments; for multi-instance Vercel, swap to KV)
const checkRateLimit = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
```

The call site further down (`if (!checkRateLimit(ip)) {`) is unchanged — `checkRateLimit` still has the same `(key: string) => boolean` shape.

- [ ] **Step 6: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint app/api/contact/route.ts lib/rateLimit.ts`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add lib/rateLimit.ts lib/__tests__/rateLimit.test.ts app/api/contact/route.ts
git commit -m "refactor: extract shared rate limiter into lib/rateLimit.ts"
```

---

### Task 4: Add the Supabase table and server client

**Files:**
- Create: `supabase/migrations/0001_fitment_leads.sql`
- Create: `lib/supabase.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `getSupabaseServerClient(): SupabaseClient` — a server-only Supabase client authenticated with the service-role key.
- Produces: table `fitment_leads` in Postgres with columns `id, email, role_title, jd_text, jd_source, score, verdict, created_at`.

- [ ] **Step 1: Install the Supabase client library**

Run:
```
npm install @supabase/supabase-js
```
Expected: `package.json` gains `"@supabase/supabase-js"` under `dependencies`.

- [ ] **Step 2: Write the migration SQL**

Create `d:\Work-Projects\merito-website-v2\supabase\migrations\0001_fitment_leads.sql`:

```sql
create table if not exists fitment_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role_title text not null,
  jd_text text not null,
  jd_source text not null check (jd_source in ('paste', 'link')),
  score numeric not null check (score >= 0 and score <= 10),
  verdict text not null,
  created_at timestamptz not null default now()
);

create index if not exists fitment_leads_email_idx on fitment_leads (email);
```

This file is not run automatically by this plan — it is applied once, by hand, against the Supabase project (Supabase SQL editor, or `supabase db push` if the Supabase CLI is later adopted). Note that in the plan's own step list below.

- [ ] **Step 3: Apply the migration**

Open the Supabase project's SQL editor (console.supabase.com → the project → SQL Editor) and run the contents of `supabase/migrations/0001_fitment_leads.sql`.
Expected: `fitment_leads` appears under Table Editor with the 7 columns above.

- [ ] **Step 4: Add the Supabase server client**

Create `d:\Work-Projects\merito-website-v2\lib\supabase.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).");
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}
```

This is server-only — it reads the **service role** key (bypasses row-level security), so it must never be imported from a client component. It will only be imported from the Route Handler in Task 7.

- [ ] **Step 5: Add the new env vars to `.env.example`**

In `d:\Work-Projects\merito-website-v2\.env.example`, append:

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

(`ANTHROPIC_API_KEY` is added here now since Task 6 needs it — keeps all new env vars in one place.)

- [ ] **Step 6: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json supabase/migrations/0001_fitment_leads.sql lib/supabase.ts .env.example
git commit -m "feat(hub): add Supabase client and fitment_leads table migration"
```

---

### Task 5: Add CV text extraction

**Files:**
- Create: `lib/parseCvFile.ts`
- Test: `lib/__tests__/parseCvFile.test.ts`

**Interfaces:**
- Produces: `parseCvFile(file: File): Promise<string>` — returns extracted plain text. Throws `UnsupportedCvFileError` (exported) for anything that isn't a parseable PDF or DOCX.

- [ ] **Step 1: Install the parsing libraries**

Run:
```
npm install pdf-parse mammoth
npm install -D @types/pdf-parse
```
Expected: `pdf-parse` and `mammoth` under `dependencies`, `@types/pdf-parse` under `devDependencies`.

- [ ] **Step 2: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\__tests__\parseCvFile.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseCvFile, UnsupportedCvFileError } from "../parseCvFile";

function makeFile(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes], name, { type });
}

describe("parseCvFile", () => {
  it("rejects a file that is neither PDF nor DOCX by extension", async () => {
    const file = makeFile(new Uint8Array([1, 2, 3]), "resume.txt", "text/plain");
    await expect(parseCvFile(file)).rejects.toBeInstanceOf(UnsupportedCvFileError);
  });

  it("rejects a corrupt file with a PDF extension", async () => {
    const file = makeFile(new Uint8Array([0, 0, 0, 0]), "resume.pdf", "application/pdf");
    await expect(parseCvFile(file)).rejects.toBeInstanceOf(UnsupportedCvFileError);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- lib/__tests__/parseCvFile.test.ts`
Expected: FAIL — `Cannot find module '../parseCvFile'`.

- [ ] **Step 4: Create `lib/parseCvFile.ts`**

Create `d:\Work-Projects\merito-website-v2\lib\parseCvFile.ts`:

```ts
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export class UnsupportedCvFileError extends Error {
  constructor(message = "Unsupported or unreadable CV file.") {
    super(message);
    this.name = "UnsupportedCvFileError";
  }
}

export async function parseCvFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf")) {
    try {
      const result = await pdfParse(buffer);
      const text = result.text.trim();
      if (!text) throw new Error("empty");
      return text;
    } catch {
      throw new UnsupportedCvFileError();
    }
  }

  if (name.endsWith(".docx")) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (!text) throw new Error("empty");
      return text;
    } catch {
      throw new UnsupportedCvFileError();
    }
  }

  throw new UnsupportedCvFileError();
}
```

- [ ] **Step 5: Run the test again to verify it passes**

Run: `npm test -- lib/__tests__/parseCvFile.test.ts`
Expected: `2 passed`.

- [ ] **Step 6: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint lib/parseCvFile.ts`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/parseCvFile.ts lib/__tests__/parseCvFile.test.ts
git commit -m "feat(hub): add CV text extraction (PDF/DOCX)"
```

---

### Task 6: Add Claude-backed fitment scoring

**Files:**
- Create: `lib/scoreFitment.ts`
- Test: `lib/__tests__/scoreFitment.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `type FitmentResult = { score: number; verdict: string }`; `scoreFitment(jdText: string, cvText: string): Promise<FitmentResult>`. This is the swappable interface named in the spec — Task 7 depends on this exact function name and signature.

- [ ] **Step 1: Install the Anthropic SDK and zod**

Run:
```
npm install @anthropic-ai/sdk zod
```
Expected: both added under `dependencies`.

- [ ] **Step 2: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\__tests__\scoreFitment.test.ts`. This mocks the Anthropic SDK so the test suite never makes a real API call:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const parseMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { parse: parseMock };
    },
  };
});

describe("scoreFitment", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("returns the parsed score and verdict from Claude", async () => {
    parseMock.mockResolvedValue({
      parsed_output: { score: 7.8, verdict: "Good fit for this role." },
    });
    const { scoreFitment } = await import("../scoreFitment");
    const result = await scoreFitment("Senior Product Manager JD text", "CV text");
    expect(result).toEqual({ score: 7.8, verdict: "Good fit for this role." });
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("throws if Claude returns no parsed output", async () => {
    parseMock.mockResolvedValue({ parsed_output: null });
    const { scoreFitment } = await import("../scoreFitment");
    await expect(scoreFitment("jd", "cv")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- lib/__tests__/scoreFitment.test.ts`
Expected: FAIL — `Cannot find module '../scoreFitment'`.

- [ ] **Step 4: Create `lib/scoreFitment.ts`**

Create `d:\Work-Projects\merito-website-v2\lib\scoreFitment.ts`. Uses `claude-haiku-4-5` (cheapest/fastest tier — this runs on every anonymous form submit) and structured outputs via `client.messages.parse()` + a Zod schema, so the response is guaranteed to match the shape rather than relying on prompt-only JSON:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export type FitmentResult = {
  score: number;
  verdict: string;
};

const FitmentSchema = z.object({
  score: z.number().min(0).max(10),
  verdict: z.string(),
});

export async function scoreFitment(jdText: string, cvText: string): Promise<FitmentResult> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content:
          "You are scoring how well a candidate's CV fits a job description.\n\n" +
          `Job description:\n${jdText}\n\n` +
          `Candidate CV:\n${cvText}\n\n` +
          "Score the fit from 0 to 10 (one decimal place) and give a single-sentence verdict explaining the score.",
      },
    ],
    output_config: {
      format: zodOutputFormat(FitmentSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable fitment result.");
  }

  return response.parsed_output;
}
```

- [ ] **Step 5: Run the test again to verify it passes**

Run: `npm test -- lib/__tests__/scoreFitment.test.ts`
Expected: `2 passed`.

- [ ] **Step 6: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint lib/scoreFitment.ts`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/scoreFitment.ts lib/__tests__/scoreFitment.test.ts
git commit -m "feat(hub): add Claude-backed fitment scoring (claude-haiku-4-5)"
```

---

### Task 7: Add `POST /api/hub/fitment-check`

Wires Tasks 2-6 together: verify reCAPTCHA → rate-limit by email → parse CV → score → insert into Supabase → respond. This is the task the design spec's data-flow section describes end to end.

**Files:**
- Create: `app/api/hub/fitment-check/route.ts`
- Test: `app/api/hub/fitment-check/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `verifyRecaptchaToken` (`lib/recaptcha.ts`), `createRateLimiter` (`lib/rateLimit.ts`), `parseCvFile` + `UnsupportedCvFileError` (`lib/parseCvFile.ts`), `scoreFitment` (`lib/scoreFitment.ts`), `getSupabaseServerClient` (`lib/supabase.ts`).
- Produces: `POST /api/hub/fitment-check` — accepts `multipart/form-data` with fields `email`, `role`, `jdText` (or `jdUrl`), `cv` (file), `recaptchaToken`. Returns `200 {score, verdict}` on success; `400 {error}` for validation/recaptcha/parse failures; `429 {error}` for rate limiting.

- [ ] **Step 1: Write the failing tests**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\fitment-check\__tests__\route.test.ts`. Every dependency is mocked so the test never hits reCAPTCHA, Claude, or Supabase:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/recaptcha", () => ({
  verifyRecaptchaToken: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/parseCvFile", () => ({
  parseCvFile: vi.fn().mockResolvedValue("Extracted CV text"),
  UnsupportedCvFileError: class UnsupportedCvFileError extends Error {},
}));
vi.mock("@/lib/scoreFitment", () => ({
  scoreFitment: vi.fn().mockResolvedValue({ score: 7.8, verdict: "Good fit." }),
}));

const insertMock = vi.fn().mockResolvedValue({ error: null });
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

describe("POST /api/hub/fitment-check", () => {
  beforeEach(() => {
    insertMock.mockClear();
  });

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

  it("rejects a submission with an unsupported file type", async () => {
    const { parseCvFile, UnsupportedCvFileError } = await import("@/lib/parseCvFile");
    vi.mocked(parseCvFile).mockRejectedValueOnce(new UnsupportedCvFileError());
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a submission that fails reCAPTCHA", async () => {
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
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- app/api/hub/fitment-check/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Create the route handler**

Create `d:\Work-Projects\merito-website-v2\app\api\hub\fitment-check\route.ts`:

```ts
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { createRateLimiter } from "@/lib/rateLimit";
import { parseCvFile, UnsupportedCvFileError } from "@/lib/parseCvFile";
import { scoreFitment } from "@/lib/scoreFitment";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Placeholder threshold — exact limit is an open decision (see spec §Explicit open items).
const checkEmailRateLimit = createRateLimiter({ max: 3, windowMs: 60 * 60 * 1000 });

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = normalize(form.get("email"));
  const role = normalize(form.get("role"));
  const jdText = normalize(form.get("jdText"));
  const jdUrl = normalize(form.get("jdUrl"));
  const recaptchaToken = normalize(form.get("recaptchaToken"));
  const cv = form.get("cv");

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!role) {
    return Response.json({ error: "Target role is required." }, { status: 400 });
  }
  if (!jdText && !jdUrl) {
    return Response.json({ error: "Paste a job description or provide a link." }, { status: 400 });
  }
  if (!(cv instanceof File) || cv.size === 0) {
    return Response.json({ error: "A CV file is required." }, { status: 400 });
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

  if (!checkEmailRateLimit(email)) {
    return Response.json(
      { error: "You've checked your fitment recently — please try again later." },
      { status: 429 }
    );
  }

  let cvText: string;
  try {
    cvText = await parseCvFile(cv);
  } catch (err) {
    if (err instanceof UnsupportedCvFileError) {
      return Response.json({ error: "We couldn't read that file — please upload a PDF or DOCX." }, { status: 400 });
    }
    return Response.json({ error: "Something went wrong reading your CV." }, { status: 500 });
  }

  // jdUrl fetching/extraction is a follow-up (see spec §Explicit open items) —
  // for now, a link is stored as the JD source but the pasted text (if any) is
  // what's scored. If only a link was given, use it as the JD text placeholder.
  const jdSource = jdText ? "paste" : "link";
  const jdForScoring = jdText || jdUrl;

  let result;
  try {
    result = await scoreFitment(jdForScoring, cvText);
  } catch {
    return Response.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }

  const supabase = getSupabaseServerClient();
  const { error: insertError } = await supabase.from("fitment_leads").insert({
    email,
    role_title: role,
    jd_text: jdForScoring,
    jd_source: jdSource,
    score: result.score,
    verdict: result.verdict,
  });

  if (insertError) {
    return Response.json({ error: "Something went wrong saving your result." }, { status: 500 });
  }

  return Response.json({ score: result.score, verdict: result.verdict });
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npm test -- app/api/hub/fitment-check/__tests__/route.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests across every `*.test.ts` file pass (setup, recaptcha, rateLimit, parseCvFile, scoreFitment, route).

- [ ] **Step 6: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint app/api/hub/fitment-check/route.ts`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add app/api/hub/fitment-check/route.ts app/api/hub/fitment-check/__tests__/route.test.ts
git commit -m "feat(hub): add POST /api/hub/fitment-check route"
```

---

### Task 8: Wire `FitmentChecker.tsx` to the real endpoint

Replaces the local fake-hash scoring with a real form: adds the missing email field, splits the JD input into paste/link modes (matching the dashboard prototype's existing toggle pattern), replaces the "tap to simulate" CV toggle with a real file input, and adds the reCAPTCHA widget using the exact pattern already in `components/ContactForm.tsx`.

**Files:**
- Modify: `app/hub/FitmentChecker.tsx`

**Interfaces:**
- Consumes: `POST /api/hub/fitment-check` (Task 7) — sends `multipart/form-data` with `email, role, jdText|jdUrl, cv, recaptchaToken`; expects `{score, verdict}` on 200 or `{error}` on 4xx/5xx.

- [ ] **Step 1: Replace the component**

Read the current file first (`app/hub/FitmentChecker.tsx`) to confirm no unrelated edits have landed since this plan was written, then replace its entire contents with:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement, options: { sitekey: string }) => number;
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
      ready: (cb: () => void) => void;
    };
    onRecaptchaLoad?: () => void;
  }
}

type JdMode = "paste" | "link";

export default function FitmentChecker() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [jdMode, setJdMode] = useState<JdMode>("paste");
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const [verdict, setVerdict] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
  const recaptchaEnabled = Boolean(recaptchaSiteKey);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!recaptchaEnabled) return;
    const renderWidget = () => {
      if (recaptchaContainerRef.current && window.grecaptcha?.render && widgetIdRef.current === null) {
        widgetIdRef.current = window.grecaptcha.render(recaptchaContainerRef.current, {
          sitekey: recaptchaSiteKey,
        });
      }
    };
    if (window.grecaptcha?.render) {
      window.grecaptcha.ready(renderWidget);
    } else {
      window.onRecaptchaLoad = renderWidget;
    }
    return () => {
      widgetIdRef.current = null;
    };
  }, [recaptchaEnabled, recaptchaSiteKey]);

  const roleLabel = role.trim() || "your target role";
  const canSubmit = email.trim() && role.trim() && (jdText.trim() || jdUrl.trim()) && cvFile && !checking;

  const animateScore = (target: number) => {
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1500);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(target * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const checkFit = async () => {
    if (!canSubmit || !cvFile) return;
    setErrorMsg(null);
    setChecking(true);
    setScore(null);
    setShown(0);

    let recaptchaToken = "";
    if (recaptchaEnabled) {
      recaptchaToken = window.grecaptcha?.getResponse?.(widgetIdRef.current ?? undefined) || "";
      if (!recaptchaToken) {
        setChecking(false);
        setErrorMsg("Please verify that you are not a robot.");
        return;
      }
    }

    const form = new FormData();
    form.set("email", email.trim());
    form.set("role", role.trim());
    if (jdMode === "paste") form.set("jdText", jdText.trim());
    else form.set("jdUrl", jdUrl.trim());
    form.set("cv", cvFile);
    form.set("recaptchaToken", recaptchaToken);

    try {
      const res = await fetch("/api/hub/fitment-check", { method: "POST", body: form });
      const data = (await res.json()) as { score?: number; verdict?: string; error?: string };
      window.grecaptcha?.reset?.(widgetIdRef.current ?? undefined);
      if (!res.ok || typeof data.score !== "number") {
        setChecking(false);
        setErrorMsg(data.error || "Something went wrong — please try again.");
        return;
      }
      setChecking(false);
      setScore(data.score);
      setVerdict(data.verdict || "");
      animateScore(data.score);
    } catch {
      window.grecaptcha?.reset?.(widgetIdRef.current ?? undefined);
      setChecking(false);
      setErrorMsg("Something went wrong — please try again.");
    }
  };

  const hasScore = !!score;
  const noScore = !score && !checking;

  return (
    <div
      id="fit-checker"
      className="bg-[#fdf8fb] border border-black/[0.08] w-full"
      style={{ borderRadius: 24, boxShadow: "0px 18px 50px rgba(17,35,89,0.05)", padding: 24 }}
    >
      <style>{`
        @keyframes hub-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.55; } }
      `}</style>
      {recaptchaEnabled ? (
        <Script src="https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit" strategy="afterInteractive" />
      ) : null}

      <div className="flex items-center gap-2.5" style={{ marginBottom: 18 }}>
        <span
          className="rounded-full bg-[#ed1a24] inline-block"
          style={{ width: 10, height: 10, animation: "hub-pulse 2s ease-in-out infinite" }}
        />
        <span
          className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#4b4b4d]"
          style={{ fontSize: 13, letterSpacing: "0.06em" }}
        >
          Job Fitment Score - Free
        </span>
      </div>

      <label className="block font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12, marginBottom: 6 }}>
        Your email
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
        style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
      />

      <label className="block font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12, marginBottom: 6 }}>
        The role you want
      </label>
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="e.g. Senior Product Manager"
        className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
        style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
      />

      <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
        <label className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12 }}>
          Job description
        </label>
        <div className="flex border border-[#dcdcdc] overflow-hidden" style={{ borderRadius: 50, marginLeft: "auto" }}>
          <button
            type="button"
            onClick={() => setJdMode("paste")}
            className="font-[family-name:var(--font-poppins)] font-semibold transition-all"
            style={{
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              padding: "5px 12px",
              background: jdMode === "paste" ? "#ed1a24" : "#fff",
              color: jdMode === "paste" ? "#fff" : "#4b4b4d",
            }}
          >
            Paste JD
          </button>
          <button
            type="button"
            onClick={() => setJdMode("link")}
            className="font-[family-name:var(--font-poppins)] font-semibold transition-all"
            style={{
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              padding: "5px 12px",
              background: jdMode === "link" ? "#ed1a24" : "#fff",
              color: jdMode === "link" ? "#fff" : "#4b4b4d",
            }}
          >
            JD link
          </button>
        </div>
      </div>
      {jdMode === "paste" ? (
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the full job description here..."
          className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors resize-none"
          style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, height: 88, marginBottom: 12 }}
        />
      ) : (
        <input
          value={jdUrl}
          onChange={(e) => setJdUrl(e.target.value)}
          placeholder="https://company.com/careers/role"
          className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
          style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          if (file && file.size > 5 * 1024 * 1024) {
            setErrorMsg("That file is too large — please upload a CV under 5MB.");
            return;
          }
          setErrorMsg(null);
          setCvFile(file);
        }}
      />
      <div
        onClick={() => fileInputRef.current?.click()}
        className="bg-white cursor-pointer flex items-center transition-colors"
        style={{
          border: `1.5px dashed ${cvFile ? "#22c55e" : "#dcdcdc"}`,
          borderRadius: 10,
          padding: "14px 16px",
          gap: 12,
        }}
      >
        <svg width="20" height="20" fill="none" stroke={cvFile ? "#22c55e" : "#9c9c9c"} strokeWidth="2" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
        <span
          className="font-[family-name:var(--font-poppins)] font-semibold"
          style={{ fontSize: 13, color: cvFile ? "#16803c" : "#4b4b4d" }}
        >
          {cvFile ? `${cvFile.name} - ready ✓` : "Upload your CV (PDF or DOCX)"}
        </span>
      </div>

      {recaptchaEnabled ? (
        <div style={{ marginTop: 14 }}>
          <div className="origin-top-left scale-[0.82] sm:scale-100" style={{ width: 300 }}>
            <div ref={recaptchaContainerRef} />
          </div>
        </div>
      ) : null}

      <button
        onClick={checkFit}
        disabled={!canSubmit}
        className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white transition-colors"
        style={{
          marginTop: 14,
          height: 50,
          borderRadius: 8,
          fontSize: 15,
          background: canSubmit ? "#ed1a24" : "#dcdcdc",
          cursor: canSubmit ? "pointer" : "default",
          boxShadow: canSubmit ? "0px 4px 6px rgba(236,34,40,0.3)" : "none",
          border: "none",
        }}
      >
        {checking ? "Scoring your CV…" : "Check my fitment - free"}
      </button>

      {errorMsg && (
        <p className="text-center" style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10 }}>
          {errorMsg}
        </p>
      )}

      {noScore && !errorMsg && (
        <div
          className="bg-white border border-black/[0.08] relative"
          style={{ marginTop: 18, borderRadius: 14, padding: 18, boxShadow: "0px 4px 16px rgba(17,35,89,0.04)" }}
        >
          <span
            className="absolute font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c] bg-white border border-[#dcdcdc]"
            style={{ top: 14, right: 14, fontSize: 9, letterSpacing: "0.06em", borderRadius: 50, padding: "3px 9px" }}
          >
            Sample
          </span>
          <div className="flex items-baseline justify-between" style={{ opacity: 0.75 }}>
            <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "2.6rem", lineHeight: 1, whiteSpace: "nowrap" }}>
              7.8<span className="font-semibold text-[#9c9c9c]" style={{ fontSize: "1.1rem" }}> / 10</span>
            </span>
            <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d] text-right" style={{ fontSize: 12, marginRight: 56 }}>
              fit for Senior Product Manager
            </span>
          </div>
          <div className="bg-[#f0e6ea] overflow-hidden" style={{ marginTop: 12, height: 10, borderRadius: 6, opacity: 0.75 }}>
            <div className="bg-[#ed1a24] h-full" style={{ borderRadius: 6, width: "78%" }} />
          </div>
          <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "14px 0 0", lineHeight: 1.6 }}>
            Fill in the form above to get your real score.
          </p>
        </div>
      )}

      {hasScore && (
        <div
          className="bg-white border border-black/[0.08]"
          style={{ marginTop: 18, borderRadius: 14, padding: 18, boxShadow: "0px 4px 16px rgba(17,35,89,0.04)" }}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "2.6rem", lineHeight: 1, whiteSpace: "nowrap" }}>
              {shown.toFixed(1)}<span className="font-semibold text-[#9c9c9c]" style={{ fontSize: "1.1rem" }}> / 10</span>
            </span>
            <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d] text-right" style={{ fontSize: 12 }}>
              fit for {roleLabel}
            </span>
          </div>
          <div className="bg-[#f0e6ea] overflow-hidden" style={{ marginTop: 12, height: 10, borderRadius: 6 }}>
            <div className="bg-[#ed1a24] h-full" style={{ borderRadius: 6, width: shown * 10 + "%" }} />
          </div>
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: "12px 0 0" }}>
            {verdict}
          </p>
          <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "14px 0 0", lineHeight: 1.6 }}>
            Create your free account to unlock the full report - strengths, gaps, and exactly what to fix.
          </p>
        </div>
      )}

      <p className="font-[family-name:var(--font-poppins)] font-medium text-[#9c9c9c] text-center" style={{ fontSize: 12, margin: "14px 0 0" }}>
        Free · Takes 60 seconds
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint app/hub/FitmentChecker.tsx`
Expected: no output, exit code 0.

- [ ] **Step 3: Manual verification in the browser**

Run: `npm run dev` (background), then open `http://localhost:3000/hub` in a browser (or use the `run` skill if driving this headlessly) and:
1. Confirm the submit button is disabled until email, role, a JD (paste or link), and a CV file are all filled in.
2. Confirm switching the "Paste JD / JD link" toggle swaps the textarea for the URL input and back.
3. Confirm clicking the upload zone opens a file picker restricted to `.pdf`/`.docx`.
4. With `ANTHROPIC_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local`, submit the form with a real PDF and confirm a real (non-7.8-placeholder) score animates in.
5. Confirm a row appears in the Supabase `fitment_leads` table with the submitted email/role and the returned score — and confirm no CV content appears anywhere in that row.

- [ ] **Step 4: Commit**

```bash
git add app/hub/FitmentChecker.tsx
git commit -m "feat(hub): wire FitmentChecker to real fitment-check API"
```

---

### Task 9: End-to-end verification against the real Claude API

The spec calls for one real run before shipping, on top of the mocked unit tests from Tasks 6-7. This task is manual — there is no automated step here — but it must be done before this phase is considered complete.

- [ ] **Step 1: Confirm required env vars are set** (locally in `.env.local`, and in Vercel's project settings before this branch is deployed):
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
  - `RECAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (optional locally, required in production)

- [ ] **Step 2: Run the full automated suite one more time**

Run: `npm test`
Expected: all tests pass.

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output.

Run: `npx eslint app lib`
Expected: no output (or only pre-existing warnings unrelated to this change — see the earlier `about page`/`offervault`/`page.tsx`/`ramp` unused-`Link` warnings already present in the repo).

- [ ] **Step 3: Real end-to-end run**

With the dev server running and real env vars set, submit the `/hub` fitment checker with a real CV file (a real PDF resume) and a real job description. Confirm:
- The returned score is plausible for the CV/JD pair (not always the same number, not obviously random).
- The verdict sentence is coherent and relates to the actual JD/CV content.
- A row lands in `fitment_leads` in Supabase with that score and verdict.
- No `.pdf`/`.docx` content appears in Supabase, in any log line, or anywhere on disk.

- [ ] **Step 4: Note the outcome**

If everything above holds, Phase 0 is done. If the score/verdict quality is poor, that's a prompt-tuning follow-up to `lib/scoreFitment.ts` — not a reason to change the architecture from this plan.
