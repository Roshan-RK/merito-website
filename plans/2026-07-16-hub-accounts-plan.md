# Merito HUB — Phase 1: Accounts (Magic-Link Signup/Login) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give candidates a real account. A magic-link (passwordless email) login flow, backed by Supabase Auth, that on first login claims every one of that email's anonymous `fitment_leads` rows from Phase 0 and lands the candidate on a bare confirmation page showing them.

**Architecture:** Same Next.js 15 App Router app, same deployment, no new service. New pieces: a second, cookie-aware/RLS-respecting Supabase client (`lib/supabaseAuth.ts`) alongside Phase 0's admin client; a `user_id` column + RLS policy added to the existing `fitment_leads` table; a login page, an auth callback Route Handler, a `proxy.ts` route guard, and a bare account page.

**Tech Stack:** Next.js 15 App Router, `@supabase/ssr` (new dependency, verified at `0.12.3` — `createServerClient`/`createBrowserClient` with the `getAll`/`setAll` cookie-methods API), `@supabase/supabase-js` (already a dependency), Vitest (already set up).

## Global Constraints

- No new dashboard UI. `/hub/account` is bare/unstyled — the real dashboard is Phase 2's job, once there's a report and a personality test to put in it.
- Magic link only. No password field, no OAuth provider, anywhere in this phase.
- Two Supabase clients, never confused: `lib/supabase.ts` (existing, admin/service-role, bypasses RLS — used only for the trusted server-side claim operation) vs. `lib/supabaseAuth.ts` (new, anon-key/cookie-based, RLS-respecting — used for anything touching a logged-in user's own session or data).
- Claim **all** unclaimed `fitment_leads` rows matching an email, not just the most recent.
- Claim failure is logged but never blocks login — the callback route always redirects to `/hub/account` on a successful code exchange, regardless of whether the claim succeeded.
- This repo's installed Next.js version has **renamed `middleware.ts` to `proxy.ts`** — the file must be named `proxy.ts` at the repo root, exporting a function named `proxy` (not `middleware`), confirmed against `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` in this repo. Do not write `middleware.ts`.
- `cookies()` from `next/headers` is **async** in this Next.js version — always `await cookies()`.
- Match existing code style: double quotes, semicolons, `lib/` flat-file convention, Tailwind arbitrary-value className strings for any UI.
- No automated tests for React pages/components or `proxy.ts` — this repo has no component/browser test infrastructure (confirmed in Phase 0). Verification for those is manual, not invented test infra.
- Never `git add -A`; stage explicitly.
- `docs/` is gitignored in this repo — this plan and its spec live in `plans/` and `specs/`, which are tracked normally.

---

### Task 1: Add `@supabase/ssr`, the `user_id` migration, and the auth Supabase client

**Files:**
- Create: `supabase/migrations/0002_fitment_leads_user_id.sql`
- Create: `lib/supabaseAuth.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `createSupabaseServerClient(): Promise<SupabaseClient>` — cookie-aware, RLS-respecting, for Server Components and Route Handlers.
- Produces: `createSupabaseBrowserClient(): SupabaseClient` — for client components.

- [ ] **Step 1: Install `@supabase/ssr`**

Run:
```
npm install @supabase/ssr
```
Expected: `package.json` gains `"@supabase/ssr"` under `dependencies`. (Verified during planning: the installed version's `createServerClient`/`createBrowserClient` use the `getAll`/`setAll` cookie-methods API shown below — the `get`/`set`/`remove` shape is deprecated in this version and must not be used.)

- [ ] **Step 2: Write the migration SQL**

Create `d:\Work-Projects\merito-website-v2\supabase\migrations\0002_fitment_leads_user_id.sql`:

```sql
alter table fitment_leads
  add column if not exists user_id uuid references auth.users(id);

create index if not exists fitment_leads_user_id_idx on fitment_leads (user_id);

alter table fitment_leads enable row level security;

create policy "Users can view their own claimed fitment leads"
  on fitment_leads
  for select
  using (auth.uid() = user_id);
```

This is not applied automatically by this plan — like Phase 0's migration, it is applied once, by hand, in the Supabase project's SQL editor. Note that in your report; do not attempt to run it against a real project (no credentials exist in this environment).

- [ ] **Step 3: Add the new env vars**

In `d:\Work-Projects\merito-website-v2\.env.example`, append (after the existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` lines added in Phase 0):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`NEXT_PUBLIC_SUPABASE_URL` will hold the same URL value as the existing `SUPABASE_URL`, just re-declared under the `NEXT_PUBLIC_` prefix Next.js requires for anything read in browser code. The anon key is a different, publishable credential from the service-role key — safe to expose client-side by design.

- [ ] **Step 4: Create `lib/supabaseAuth.ts`**

Create `d:\Work-Projects\merito-website-v2\lib\supabaseAuth.ts`:

```ts
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing).");
  }

  return { url, anonKey };
}

/**
 * Cookie-aware, RLS-respecting client for Server Components and Route
 * Handlers. Create a fresh one per request — never cache/share across
 * requests, since it carries per-request cookie state.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, anonKey } = getPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component during render, where cookies
          // can't be set. Safe to ignore here — proxy.ts refreshes the
          // session on every request, so an expired write here doesn't
          // strand the user; Route Handlers (which CAN set cookies) are
          // where session writes actually need to succeed.
        }
      },
    },
  });
}

/** Browser client for client components (e.g. the login page). */
export function createSupabaseBrowserClient(): SupabaseClient {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
```

- [ ] **Step 5: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint lib/supabaseAuth.ts`
Expected: no output, exit code 0.

No test file for this task — matches Phase 0's precedent for `lib/supabase.ts` (a thin Supabase client factory with no independently-testable logic; later tasks exercise it via mocking).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json supabase/migrations/0002_fitment_leads_user_id.sql lib/supabaseAuth.ts .env.example
git commit -m "feat(hub): add @supabase/ssr client and user_id claim migration"
```

---

### Task 2: Add `lib/claimFitmentLeads.ts`

**Files:**
- Create: `lib/claimFitmentLeads.ts`
- Test: `lib/__tests__/claimFitmentLeads.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient()` from `lib/supabase.ts` (the existing Phase 0 admin client factory).
- Produces: `claimFitmentLeads(userId: string, email: string): Promise<{ claimedCount: number }>` — this exact name and signature is what Task 3 (the callback route) imports.

- [ ] **Step 1: Write the failing test**

Create `d:\Work-Projects\merito-website-v2\lib\__tests__\claimFitmentLeads.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn();
const isMock = vi.fn();
const selectMock = vi.fn();
const updateMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: fromMock,
  }),
}));

describe("claimFitmentLeads", () => {
  beforeEach(() => {
    fromMock.mockReset();
    updateMock.mockReset();
    eqMock.mockReset();
    isMock.mockReset();
    selectMock.mockReset();

    // Chain: from("fitment_leads").update({...}).eq("email", ...).is("user_id", null).select("id")
    fromMock.mockReturnValue({ update: updateMock });
    updateMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ is: isMock });
    isMock.mockReturnValue({ select: selectMock });
  });

  it("updates every unclaimed row matching the email and returns the claimed count", async () => {
    selectMock.mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });
    const { claimFitmentLeads } = await import("../claimFitmentLeads");

    const result = await claimFitmentLeads("user-123", "candidate@example.com");

    expect(fromMock).toHaveBeenCalledWith("fitment_leads");
    expect(updateMock).toHaveBeenCalledWith({ user_id: "user-123" });
    expect(eqMock).toHaveBeenCalledWith("email", "candidate@example.com");
    expect(isMock).toHaveBeenCalledWith("user_id", null);
    expect(result).toEqual({ claimedCount: 2 });
  });

  it("returns zero when nothing matches", async () => {
    selectMock.mockResolvedValue({ data: [], error: null });
    const { claimFitmentLeads } = await import("../claimFitmentLeads");

    const result = await claimFitmentLeads("user-123", "nobody@example.com");

    expect(result).toEqual({ claimedCount: 0 });
  });

  it("throws if Supabase returns an error", async () => {
    selectMock.mockResolvedValue({ data: null, error: { message: "db error" } });
    const { claimFitmentLeads } = await import("../claimFitmentLeads");

    await expect(claimFitmentLeads("user-123", "candidate@example.com")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/__tests__/claimFitmentLeads.test.ts`
Expected: FAIL — `Cannot find module '../claimFitmentLeads'`.

- [ ] **Step 3: Create `lib/claimFitmentLeads.ts`**

Create `d:\Work-Projects\merito-website-v2\lib\claimFitmentLeads.ts`:

```ts
import { getSupabaseServerClient } from "@/lib/supabase";

export async function claimFitmentLeads(userId: string, email: string): Promise<{ claimedCount: number }> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("fitment_leads")
    .update({ user_id: userId })
    .eq("email", email)
    .is("user_id", null)
    .select("id");

  if (error) {
    throw new Error(`Failed to claim fitment leads: ${error.message}`);
  }

  return { claimedCount: data?.length ?? 0 };
}
```

- [ ] **Step 4: Run the test again to verify it passes**

Run: `npm test -- lib/__tests__/claimFitmentLeads.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint lib/claimFitmentLeads.ts`
Expected: no output, exit code 0.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests pass, including the 3 new ones and everything from Phase 0.

- [ ] **Step 7: Commit**

```bash
git add lib/claimFitmentLeads.ts lib/__tests__/claimFitmentLeads.test.ts
git commit -m "feat(hub): add claimFitmentLeads — attach anonymous leads to a new account"
```

---

### Task 3: Add the auth callback Route Handler

**Files:**
- Create: `app/hub/auth/callback/route.ts`
- Test: `app/hub/auth/callback/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient()` from `@/lib/supabaseAuth` (Task 1). `claimFitmentLeads(userId, email)` from `@/lib/claimFitmentLeads` (Task 2).
- Produces: `GET /hub/auth/callback?code=...` — on a valid code, redirects to `/hub/account`; on an invalid/missing code, redirects to `/hub/login?error=expired`.

- [ ] **Step 1: Write the failing tests**

Create `d:\Work-Projects\merito-website-v2\app\hub\auth\callback\__tests__\route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const exchangeCodeForSessionMock = vi.fn();
const claimFitmentLeadsMock = vi.fn();

vi.mock("@/lib/supabaseAuth", () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
  }),
}));
vi.mock("@/lib/claimFitmentLeads", () => ({
  claimFitmentLeads: claimFitmentLeadsMock,
}));

async function importRoute() {
  return await import("../route");
}

describe("GET /hub/auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSessionMock.mockReset();
    claimFitmentLeadsMock.mockReset();
  });

  it("claims leads and redirects to /hub/account on a valid code", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "candidate@example.com" } },
      error: null,
    });
    claimFitmentLeadsMock.mockResolvedValue({ claimedCount: 2 });

    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?code=valid-code");
    const response = await GET(request);

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("valid-code");
    expect(claimFitmentLeadsMock).toHaveBeenCalledWith("user-123", "candidate@example.com");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/hub/account");
  });

  it("redirects to /hub/login?error=expired on an invalid code, without claiming", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid code" },
    });

    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?code=bad-code");
    const response = await GET(request);

    expect(claimFitmentLeadsMock).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/hub/login?error=expired");
  });

  it("redirects to /hub/login?error=expired when no code is present", async () => {
    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback");
    const response = await GET(request);

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/hub/login?error=expired");
  });

  it("still redirects to /hub/account even if claiming fails", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "candidate@example.com" } },
      error: null,
    });
    claimFitmentLeadsMock.mockRejectedValue(new Error("db down"));

    const { GET } = await importRoute();
    const request = new Request("http://localhost/hub/auth/callback?code=valid-code");
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/hub/account");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- app/hub/auth/callback/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Create the route handler**

Create `d:\Work-Projects\merito-website-v2\app\hub\auth\callback\route.ts`:

```ts
import { createSupabaseServerClient } from "@/lib/supabaseAuth";
import { claimFitmentLeads } from "@/lib/claimFitmentLeads";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return Response.redirect(`${origin}/hub/login?error=expired`, 307);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return Response.redirect(`${origin}/hub/login?error=expired`, 307);
  }

  const { id: userId, email } = data.user;
  if (email) {
    try {
      await claimFitmentLeads(userId, email);
    } catch (err) {
      console.error("claimFitmentLeads failed during login", err);
      // Non-fatal — the user still gets their session and lands on
      // /hub/account; they just may not see a previously-anonymous
      // score attached this one time.
    }
  }

  return Response.redirect(`${origin}/hub/account`, 307);
}
```

- [ ] **Step 4: Run the tests again to verify they pass**

Run: `npm test -- app/hub/auth/callback/__tests__/route.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint app/hub/auth/callback/route.ts`
Expected: no output, exit code 0.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/hub/auth/callback/route.ts app/hub/auth/callback/__tests__/route.test.ts
git commit -m "feat(hub): add magic-link auth callback route"
```

---

### Task 4: Add `proxy.ts` route guard

**Files:**
- Create: `proxy.ts` (repo root — NOT `middleware.ts`; see Global Constraints)

**Interfaces:**
- Consumes: `@supabase/ssr`'s `createServerClient` directly (not `lib/supabaseAuth.ts`'s Server Component variant — `proxy.ts` needs to write cookies to both the incoming request and the outgoing response, a different bridging pattern than a Server Component/Route Handler; see Step 3's code for the exact shape).
- Produces: unauthenticated requests to `/hub/account` are redirected to `/hub/login`; the `matcher` config is written generically so future protected routes can be appended later.

No test for this task — matches Global Constraints (no component/browser test infra); verified manually in Task 8.

- [ ] **Step 1: Write `proxy.ts`**

Create `d:\Work-Projects\merito-website-v2\proxy.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Not configured in this environment — let the request through rather
    // than hard-failing every page load; the protected pages themselves
    // will still fail closed if they try to read a real session.
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/hub/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/hub/account"],
};
```

- [ ] **Step 2: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint proxy.ts`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat(hub): add proxy route guard for /hub/account"
```

---

### Task 5: Add `/hub/login` page

**Files:**
- Create: `app/hub/login/page.tsx`

**Interfaces:**
- Consumes: `createSupabaseBrowserClient()` from `@/lib/supabaseAuth` (Task 1). `getAbsoluteUrl` from `@/lib/site` (existing, used for the `emailRedirectTo` URL).
- Produces: a page at `/hub/login` — email input, "Send magic link" button, "check your inbox" success state, error state.

No test for this task — matches Global Constraints. Verified manually in Task 8.

- [ ] **Step 1: Write the page**

Create `d:\Work-Projects\merito-website-v2\app\hub\login\page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseAuth";
import { getAbsoluteUrl } from "@/lib/site";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;

    setStatus("sending");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getAbsoluteUrl("/hub/auth/callback"),
      },
    });

    setStatus(error ? "error" : "sent");
  };

  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "64px 20px" }}>
      <div className="bg-white border border-black/[0.08] mx-auto" style={{ maxWidth: 440, borderRadius: 24, padding: 32, boxShadow: "0px 18px 50px rgba(17,35,89,0.05)" }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem", margin: 0 }}>
          Sign in to Merito HUB
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.6, margin: "10px 0 24px" }}>
          Enter your email and we&apos;ll send you a link to sign in — no password needed.
        </p>

        {status === "sent" ? (
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, lineHeight: 1.6 }}>
            Check your inbox — we&apos;ve sent a sign-in link to {email.trim()}.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
              style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white transition-colors"
              style={{
                height: 50,
                borderRadius: 8,
                fontSize: 15,
                background: status === "sending" ? "#dcdcdc" : "#ed1a24",
                cursor: status === "sending" ? "default" : "pointer",
                border: "none",
              }}
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && (
              <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>
                Something went wrong — please try again.
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint app/hub/login/page.tsx`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add app/hub/login/page.tsx
git commit -m "feat(hub): add /hub/login magic-link page"
```

---

### Task 6: Add `/hub/account` page

**Files:**
- Create: `app/hub/account/page.tsx`
- Create: `app/hub/account/SignOutButton.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient()` from `@/lib/supabaseAuth` (Task 1). Reads `fitment_leads` rows via the RLS-respecting client (relies on Task 1's migration's SELECT policy being applied in the real Supabase project — not verifiable in this environment, see Task 7).
- Produces: a bare page at `/hub/account` showing the current user's claimed fitment scores and a sign-out control.

No test for this task — matches Global Constraints. Verified manually in Task 8.

- [ ] **Step 1: Write the sign-out button**

Create `d:\Work-Projects\merito-website-v2\app\hub\account\SignOutButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseAuth";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/hub");
  };

  return (
    <button
      onClick={handleSignOut}
      className="font-[family-name:var(--font-poppins)] font-semibold"
      style={{
        height: 40,
        padding: "0 16px",
        borderRadius: 8,
        fontSize: 13,
        background: "transparent",
        color: "#ed1a24",
        border: "1px solid rgba(237,26,36,0.4)",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
```

- [ ] **Step 2: Write the account page**

Create `d:\Work-Projects\merito-website-v2\app\hub\account\page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabaseAuth";
import SignOutButton from "./SignOutButton";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads } = user
    ? await supabase
        .from("fitment_leads")
        .select("role_title, score, verdict, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main style={{ padding: "48px 20px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem", margin: 0 }}>
          Your Merito HUB account
        </h1>
        <SignOutButton />
      </div>

      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, marginBottom: 20 }}>
        Signed in as {user?.email}.
      </p>

      {leads && leads.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {leads.map((lead, i) => (
            <div
              key={i}
              className="bg-white border border-black/[0.08]"
              style={{ borderRadius: 14, padding: 16 }}
            >
              <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: 0 }}>
                {lead.role_title}
              </p>
              <p className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "1.5rem", margin: "6px 0" }}>
                {lead.score} / 10
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, margin: 0 }}>
                {lead.verdict}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 14 }}>
          No fitment scores yet. Head back to the HUB to check your fit for a role.
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint app/hub/account`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/page.tsx app/hub/account/SignOutButton.tsx
git commit -m "feat(hub): add bare /hub/account page with claimed scores and sign-out"
```

---

### Task 7: Wire the "create a free account" text in `FitmentChecker.tsx` to `/hub/login`

**Files:**
- Modify: `app/hub/FitmentChecker.tsx`

**Interfaces:**
- None — this is a self-contained, targeted edit to existing JSX.

Before editing, read the current file — as of this plan being written, there is exactly **one** relevant spot (not two — the empty/sample-state block was already simplified in Phase 0's Task 8 to plain guidance text with no CTA at all). The spot is the post-score panel:

```tsx
          <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "14px 0 0", lineHeight: 1.6 }}>
            Create your free account to unlock the full report - strengths, gaps, and exactly what to fix.
          </p>
```

If the file has changed since this plan was written and that exact block isn't present, find the current equivalent (search for the text "Create your free account") and adapt this task to it — but do not invent a second CTA that doesn't exist in the file.

No test for this task — matches Global Constraints (no component test infra).

- [ ] **Step 1: Add the `Link` import**

In `d:\Work-Projects\merito-website-v2\app\hub\FitmentChecker.tsx`, add to the top imports (after the existing `import Script from "next/script";`):

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Script from "next/script";
import Link from "next/link";
```

- [ ] **Step 2: Turn the text into a link**

Replace:

```tsx
          <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "14px 0 0", lineHeight: 1.6 }}>
            Create your free account to unlock the full report - strengths, gaps, and exactly what to fix.
          </p>
```

with:

```tsx
          <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "14px 0 0", lineHeight: 1.6 }}>
            <Link href="/hub/login" className="font-semibold text-[#ed1a24]" style={{ textDecoration: "underline" }}>
              Create your free account
            </Link>
            {" "}to unlock the full report - strengths, gaps, and exactly what to fix.
          </p>
```

- [ ] **Step 3: Typecheck and lint**

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output, exit code 0.

Run: `npx eslint app/hub/FitmentChecker.tsx`
Expected: no output, exit code 0.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests still pass (this file has no automated tests of its own, but confirms the edit didn't break anything else).

- [ ] **Step 5: Commit**

```bash
git add app/hub/FitmentChecker.tsx
git commit -m "feat(hub): link the create-account prompt to /hub/login"
```

---

### Task 8: Real end-to-end verification

Manual only — no automated step. Requires a real Supabase project with Task 1's migrations (both `0001` and `0002`) applied, and real env vars set.

- [ ] **Step 1: Confirm required env vars are set** (locally in `.env.local`, and in Vercel's project settings before this branch is deployed):
  - Everything from Phase 0's Task 9 (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, reCAPTCHA keys)
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (new, from Task 1)

- [ ] **Step 2: Apply the migration**

In the Supabase project's SQL editor, run `supabase/migrations/0002_fitment_leads_user_id.sql` (Task 1's migration) if not already applied.

In the Supabase dashboard's Auth settings, confirm the redirect URL `.../hub/auth/callback` (both local `http://localhost:3000/hub/auth/callback` and the real production domain) is in the allow-listed Redirect URLs — Supabase rejects magic-link redirects to URLs not on this list.

- [ ] **Step 3: Run the full automated suite one more time**

Run: `npm test`
Expected: all tests pass.

Run: `./node_modules/.bin/tsc --noEmit -p .`
Expected: no output.

Run: `npm run build`
Expected: a clean, successful build with the new `/hub/login`, `/hub/account`, and `/hub/auth/callback` routes listed in the output.

- [ ] **Step 4: Real end-to-end run**

With the dev server running and real env vars set:
1. Run a real fitment check on `/hub` with a real email you control (this exercises Phase 0's flow again and seeds a `fitment_leads` row for the next step).
2. Go to `/hub/login`, enter that same email, submit. Confirm "Check your inbox" appears.
3. Check that inbox, click the magic link.
4. Confirm you land on `/hub/account`, showing the score from step 1.
5. Confirm the `fitment_leads` row in Supabase now has `user_id` set to your new account's user id.
6. Sign out. Confirm you're redirected to `/hub`.
7. Visit `/hub/account` directly while signed out. Confirm you're redirected to `/hub/login`.
8. On `/hub`, confirm the "Create your free account" text in the post-score panel is now a working link to `/hub/login`.

- [ ] **Step 5: Note the outcome**

If everything above holds, Phase 1 is done. If the magic-link email never arrives, check Supabase's Auth logs and the allow-listed redirect URLs before assuming the application code is at fault — this is the most common real-world failure point for this kind of flow, not a code bug.
