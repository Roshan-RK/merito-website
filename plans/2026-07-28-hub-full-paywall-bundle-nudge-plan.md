# Full Paywall Coverage + Bundle-First Nudging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Personality test and Reference checks stop being free (UI + server-side gates, matching Report/Interview); `PriceOptionTiles` leads with bundle instead of two equal tiles; a dashboard promo card surfaces the bundle before any paywall click.

**Architecture:** All backend infra already exists (`product_unlocks` table, `isProductUnlocked`/`unlockProduct` in `lib/productUnlocks.ts`, generic `/api/hub/razorpay/initiate` already allows `personality`/`references`, `page.tsx` already computes `personalityUnlocked`/`referencesUnlocked` for `bundleEligible` but doesn't pass them down). This plan wires existing infra into two new paywall modals, two new server-side gates, and redesigns one existing component — no schema changes, no new payment routes.

**Tech Stack:** Next.js 16 (webpack dev), Supabase, Vitest, TypeScript, Razorpay Checkout.

## Global Constraints

- Bundle purchases need a `leadId` and must go through `/api/hub/unlock-report` with `product: "bundle"` (confirmed: the generic initiate route hardcodes `lead_id: null` and doesn't allow `"bundle"` in `INITIATABLE_PRODUCTS`). Solo personality/references purchases go through the generic initiate route as already supported.
- This codebase's convention (confirmed — zero test files exist for any `"use client"` component under `app/hub/account/`): React components are not unit-tested, only server routes and pure utility functions are. Don't introduce component tests as a new pattern; verify UI changes visually instead (screenshot, same approach used earlier this session for the skill-wise table).
- `RAZORPAY_BYPASS` defaults on (`process.env.RAZORPAY_BYPASS !== "false"`) — new gates must respect it the same way `start-ai-interview`/`unlock-report` already do, not introduce a separate bypass mechanism.

---

### Task 1: Server-side gate for Personality

**Files:**
- Modify: `app/api/hub/save-personality-test/route.ts`
- Test: `app/api/hub/save-personality-test/__tests__/route.test.ts` (new)

**Interfaces:**
- Consumes: `isProductUnlocked(userId, "personality")` from `lib/productUnlocks.ts` (already exists, signature: `(userId: string, product: "personality" | "references") => Promise<boolean>`).
- Produces: 402 response `{ error: "Payment required to unlock the personality test — please pay first." }` when locked and not bypassed.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

const isProductUnlockedMock = vi.fn();
vi.mock("@/lib/productUnlocks", () => ({
  isProductUnlocked: isProductUnlockedMock,
}));

const upsertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: () => ({ upsert: upsertMock }) }),
}));

async function importRoute() {
  return await import("../route");
}

const VALID_ANSWERS: Record<string, number> = {};

describe("POST /api/hub/save-personality-test — payment gate", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    isProductUnlockedMock.mockReset();
    upsertMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 402 when personality is not unlocked and bypass is off", async () => {
    vi.stubEnv("RAZORPAY_BYPASS", "false");
    isProductUnlockedMock.mockResolvedValue(false);
    const { POST } = await importRoute();

    const request = new Request("http://localhost/api/hub/save-personality-test", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Backend Engineer", answers: VALID_ANSWERS }),
    });
    const response = await POST(request);

    expect(response.status).toBe(402);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("proceeds when personality is unlocked and bypass is off", async () => {
    vi.stubEnv("RAZORPAY_BYPASS", "false");
    isProductUnlockedMock.mockResolvedValue(true);
    const { POST } = await importRoute();

    // Reuse a real complete answer set from the existing scoring tests'
    // fixture shape — swap in the actual isCompleteAnswerSet-satisfying
    // fixture already used by lib/personality's own tests when implementing,
    // rather than the empty placeholder above.
  });

  it("proceeds without checking unlock status when bypass is on (default)", async () => {
    const { POST } = await importRoute();
    // isProductUnlockedMock intentionally not stubbed to resolve true — if
    // the route incorrectly calls it and awaits a hung mock, this proves the
    // bypass path skips the check entirely.
  });
});
```

(When implementing: pull the real complete-answer fixture from `lib/personality`'s own test file so the "proceeds" tests can assert a 200, not just a non-402. The skeleton above proves the gate's shape; fill in real answers before this task is considered done.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/hub/save-personality-test`
Expected: FAIL — no unlock check exists yet, 402 test gets a 200/500 instead.

- [ ] **Step 3: Add the gate**

In `app/api/hub/save-personality-test/route.ts`, add after the existing auth check (after line 15) and before the body-parsing:

```ts
import { isProductUnlocked } from "@/lib/productUnlocks";

function isRazorpayBypassed(): boolean {
  return process.env.RAZORPAY_BYPASS !== "false";
}
```

and inside `POST`, right after the `if (!user)` block:

```ts
  if (!isRazorpayBypassed() && !(await isProductUnlocked(user.id, "personality"))) {
    return Response.json(
      { error: "Payment required to unlock the personality test — please pay first." },
      { status: 402 }
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/hub/save-personality-test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/save-personality-test/route.ts app/api/hub/save-personality-test/__tests__/route.test.ts
git commit -m "feat(hub): gate personality test save behind payment"
```

---

### Task 2: Server-side gate for References

**Files:**
- Modify: `app/api/hub/references/initiate/route.ts`
- Test: `app/api/hub/references/initiate/__tests__/route.test.ts` (check if it already exists — this session's earlier grep found `app/api/hub/references/initiate/__tests__/route.test.ts` already listed, meaning tests already exist for this route; read it first and extend it, don't overwrite)

**Interfaces:**
- Consumes: same `isProductUnlocked(userId, "references")`.
- Produces: same 402 shape as Task 1.

- [ ] **Step 1: Read the existing test file first**

This route already has a test file per this session's exploration. Read `app/api/hub/references/initiate/__tests__/route.test.ts` before writing anything — match its existing mock setup exactly (likely mocks `@/lib/referenceChecks`' `initiateReferenceCheck` and `@/lib/supabaseAuthServer`) rather than introducing a second, conflicting mock style. Add new test cases to that file:

```ts
// Add alongside existing tests, reusing whatever mock for
// createSupabaseServerClient/getUser already exists in the file.
it("returns 402 when references is not unlocked and bypass is off", async () => {
  vi.stubEnv("RAZORPAY_BYPASS", "false");
  isProductUnlockedMock.mockResolvedValue(false); // add this mock per Step 3 below
  const { POST } = await importRoute();
  const response = await POST(new Request("http://localhost/api/hub/references/initiate", { method: "POST" }));
  expect(response.status).toBe(402);
});
```

- [ ] **Step 2: Run tests to verify the new case fails**

Run: `npm test -- app/api/hub/references/initiate`
Expected: FAIL on the new 402 case.

- [ ] **Step 3: Add the gate**

In `app/api/hub/references/initiate/route.ts`:

```ts
import { isProductUnlocked } from "@/lib/productUnlocks";

function isRazorpayBypassed(): boolean {
  return process.env.RAZORPAY_BYPASS !== "false";
}
```

and inside `POST`, right after the `if (!user)` block:

```ts
  if (!isRazorpayBypassed() && !(await isProductUnlocked(user.id, "references"))) {
    return Response.json(
      { error: "Payment required to unlock reference checks — please pay first." },
      { status: 402 }
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/hub/references/initiate`
Expected: PASS, including all pre-existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add app/api/hub/references/initiate/route.ts app/api/hub/references/initiate/__tests__/route.test.ts
git commit -m "feat(hub): gate reference checks behind payment"
```

---

### Task 3: Redesign `PriceOptionTiles` — bundle leads, solo is a text link

**Files:**
- Modify: `app/hub/account/PriceOptionTiles.tsx`

**Interfaces:**
- Consumes: unchanged props (`soloProduct`, `soloLabel`, `level`, `bundleEligible`, `submitting`, `onContinue`).
- Produces: unchanged — `onContinue("solo" | "bundle")`, called by whichever element the user clicks (no more two-tile selection state).

- [ ] **Step 1: Replace the bundle-eligible branch**

In `app/hub/account/PriceOptionTiles.tsx`, remove the `useState<"solo" | "bundle">` selection state (line 23) and the two-tile block (lines 50-88) entirely. Keep the non-bundle-eligible branch (lines 30-46) exactly as-is. Replace with:

```tsx
export default function PriceOptionTiles({
  soloProduct,
  soloLabel,
  level,
  bundleEligible,
  submitting,
  onContinue,
}: PriceOptionTilesProps) {
  const soloPrice = PRODUCT_PRICING[soloProduct][level];
  const bundlePrice = PRODUCT_PRICING.bundle[level];
  const savings =
    PRODUCT_PRICING.report[level] + PRODUCT_PRICING.personality[level] + PRODUCT_PRICING.references[level] - bundlePrice;

  if (!bundleEligible) {
    return (
      <>
        <button
          onClick={() => onContinue("solo")}
          disabled={submitting}
          className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ height: 50, borderRadius: 8, fontSize: 15, background: submitting ? "#dcdcdc" : "#ed1a24", border: "none", cursor: submitting ? "default" : "pointer", boxShadow: submitting ? "none" : "0 4px 6px rgba(236,34,40,0.3)" }}
        >
          {submitting ? "Redirecting…" : `Continue to payment — ${formatPrice(soloPrice)}`}
        </button>
        <p className="text-[#9c9c9c]" style={{ fontSize: 11.5, textAlign: "center", margin: "10px 0 0" }}>
          One-time payment · No subscription · UPI, card & netbanking
        </p>
      </>
    );
  }

  return (
    <>
      <div
        style={{ background: "#12121f", borderRadius: 14, padding: 18, marginBottom: 12, cursor: submitting ? "default" : "pointer" }}
        onClick={() => !submitting && onContinue("bundle")}
      >
        <span
          className="font-[family-name:var(--font-poppins)] font-bold uppercase"
          style={{ fontSize: 10, letterSpacing: "0.06em", color: "#ed1a24" }}
        >
          Recommended · Save {formatPrice(savings)}
        </span>
        <p className="font-[family-name:var(--font-gabarito)] font-bold text-white" style={{ fontSize: "1.4rem", margin: "6px 0 4px" }}>
          Full Bundle — {formatPrice(bundlePrice)}
        </p>
        <p style={{ color: "#c7c7cf", fontSize: 11.5, margin: "0 0 12px" }}>
          Includes: Detailed Report + Personality Test + Reference Checks
        </p>
        <button
          disabled={submitting}
          className="font-[family-name:var(--font-poppins)] font-semibold"
          style={{ width: "100%", height: 44, borderRadius: 8, fontSize: 14, background: submitting ? "#dcdcdc" : "#fff", color: "#000", border: "none", cursor: submitting ? "default" : "pointer" }}
        >
          {submitting ? "Redirecting…" : "Get the bundle"}
        </button>
      </div>

      <p style={{ textAlign: "center", margin: "0 0 12px" }}>
        <span
          onClick={() => !submitting && onContinue("solo")}
          className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]"
          style={{ fontSize: 12, textDecoration: "underline", cursor: submitting ? "default" : "pointer" }}
        >
          Just {soloLabel} for {formatPrice(soloPrice)} instead →
        </span>
      </p>

      <p className="text-[#9c9c9c]" style={{ fontSize: 11.5, textAlign: "center", margin: 0 }}>
        One-time payment · No subscription · UPI, card & netbanking
      </p>
    </>
  );
}
```

Note the outer button in the earlier non-bundle branch stays; the new bundle branch's CTA button and dark card both call `onContinue("bundle")` via the card's own `onClick` (the button itself doesn't need its own handler since it's inside the clickable card — but stop propagation isn't needed since both trigger the same action).

- [ ] **Step 2: Manual verification**

Run `npm run dev`, open the Report paywall modal (existing entry point) with a test account that has `bundleEligible: true`, confirm: dark bundle card renders with correct price/savings, clicking it or its button calls through to checkout; the "Just the Report for ₹X instead" link below still works and triggers solo checkout.

- [ ] **Step 3: Run full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all pass (no test directly covers this component per the "no component tests" convention — this just confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/PriceOptionTiles.tsx
git commit -m "feat(hub): redesign PriceOptionTiles to lead with bundle over solo"
```

---

### Task 4: `PersonalityPaywallModal` and `ReferencesPaywallModal`

**Files:**
- Create: `app/hub/account/PersonalityPaywallModal.tsx`
- Create: `app/hub/account/ReferencesPaywallModal.tsx`

**Interfaces:**
- Consumes: `PriceOptionTiles` (Task 3), `PRODUCT_PRICING`/`CandidateLevel` from `lib/razorpay/pricing.ts`.
- Produces: `onUnlocked: () => void` callback, called after either a solo or bundle purchase completes.

- [ ] **Step 1: Write `PersonalityPaywallModal.tsx`**

Mirrors `InterviewPaywallModal.tsx`'s Razorpay-checkout boilerplate (script loading, `RazorpayCheckoutOptions` type, `loadRazorpayCheckoutScript`) exactly — copy that boilerplate verbatim, then:

```tsx
"use client";

import { useState } from "react";
import PriceOptionTiles from "./PriceOptionTiles";
import type { CandidateLevel } from "@/lib/razorpay/pricing";

// ... (RazorpayHandlerResponse, RazorpayCheckoutOptions, window.Razorpay decl,
//      CHECKOUT_SCRIPT_SRC, loadRazorpayCheckoutScript — copied verbatim from
//      InterviewPaywallModal.tsx)

export default function PersonalityPaywallModal({
  leadId,
  roleTitle,
  level,
  bundleEligible,
  onClose,
  onUnlocked,
}: {
  leadId: string;
  roleTitle: string;
  level: CandidateLevel;
  bundleEligible: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheckout = async (initiateUrl: string, initiateBody: object, onPaid: () => Promise<void>) => {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch(initiateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initiateBody),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaying(false);
        setError(data.error || "Something went wrong — please try again.");
        return;
      }
      // unlock-report's RAZORPAY_BYPASS path returns {status:"unlocked",...}
      // directly instead of {status:"checkout",...} — handle both.
      if (data.status !== "checkout") {
        setPaying(false);
        await onPaid();
        return;
      }
      try {
        await loadRazorpayCheckoutScript();
      } catch {
        setPaying(false);
        setError("Could not load the payment form — please try again.");
        return;
      }
      if (!window.Razorpay) {
        setPaying(false);
        setError("Could not load the payment form — please try again.");
        return;
      }
      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amountPaise,
        currency: data.currency,
        name: data.name,
        description: data.description,
        order_id: data.orderId,
        prefill: data.prefill,
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/hub/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            setPaying(false);
            if (!verifyRes.ok) {
              setError(verifyData.error || "Payment succeeded but verification failed — please contact support.");
              return;
            }
            await onPaid();
          } catch {
            setPaying(false);
            setError("Payment succeeded but verification failed — please refresh.");
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch {
      setPaying(false);
      setError("Something went wrong — please try again.");
    }
  };

  const handlePay = (selection: "solo" | "bundle") => {
    if (selection === "bundle") {
      runCheckout("/api/hub/unlock-report", { leadId, product: "bundle" }, async () => onUnlocked());
    } else {
      runCheckout("/api/hub/razorpay/initiate", { product: "personality" }, async () => onUnlocked());
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-white" style={{ maxWidth: 480, width: "100%", borderRadius: 24, padding: 28, position: "relative" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9c9c9c" }}>
          ✕
        </button>
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
          Unlock your Personality Profile
        </h2>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>
          A Big Five (OCEAN) breakdown of your working style for {roleTitle}.
        </p>
        <PriceOptionTiles
          soloProduct="personality"
          soloLabel="Just the Personality Test"
          level={level}
          bundleEligible={bundleEligible}
          submitting={paying}
          onContinue={handlePay}
        />
        {error && <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `ReferencesPaywallModal.tsx`**

Identical structure to `PersonalityPaywallModal.tsx` above, with these differences: `soloProduct="references"`, `soloLabel="Just the Reference Checks"`, header "Unlock Reference Checks", body copy about verified peer references, and `handlePay`'s solo branch calls `runCheckout("/api/hub/razorpay/initiate", { product: "references" }, ...)`. No `roleTitle`-specific copy needed beyond what's already used elsewhere — check `references/page.tsx` for exact existing copy conventions when implementing rather than inventing new copy.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (these are new files, no existing tests reference them yet).

- [ ] **Step 4: Commit**

```bash
git add app/hub/account/PersonalityPaywallModal.tsx app/hub/account/ReferencesPaywallModal.tsx
git commit -m "feat(hub): add Personality and References paywall modals"
```

---

### Task 5: Wire gating into `ProgressRail.tsx`, `page.tsx`, `DashboardClient.tsx`

**Files:**
- Modify: `app/hub/account/ProgressRail.tsx`
- Modify: `app/hub/account/page.tsx`
- Modify: `app/hub/account/DashboardClient.tsx`

**Interfaces:**
- Consumes: `personalityUnlocked`/`referencesUnlocked` — **already computed** in `page.tsx:129-132`, currently only used for `bundleEligible`; this task passes them further down instead of computing anything new.

- [ ] **Step 1: Pass the already-computed flags through `page.tsx`**

In `app/hub/account/page.tsx`, add two props to the `<DashboardClient>` call (after line 133, where `bundleEligible` is computed — `personalityUnlocked`/`referencesUnlocked` already exist as local variables there):

```tsx
    <DashboardClient
      leadId={current.id}
      roleTitle={current.role_title}
      level={level}
      bundleEligible={bundleEligible}
      personalityUnlocked={personalityUnlocked}
      referencesUnlocked={referencesUnlocked}
      ...
```

- [ ] **Step 2: Update `DashboardClient.tsx`**

Add `personalityUnlocked: boolean` and `referencesUnlocked: boolean` to its props type, add `"personality" | "references"` to the `modal` union (line 45), track local unlock state (`const [personalityUnlockedState, setPersonalityUnlockedState] = useState(personalityUnlocked)` and same for references — same pattern as `reportUnlocked`), pass them to `ProgressRail` alongside new `onOpenPersonalityPaywall`/`onOpenReferencesPaywall` callbacks, and render the two new modals:

```tsx
      {modal === "personality" && (
        <PersonalityPaywallModal
          leadId={leadId}
          roleTitle={roleTitle}
          level={level}
          bundleEligible={bundleEligible}
          onClose={() => setModal("none")}
          onUnlocked={() => {
            setPersonalityUnlockedState(true);
            setModal("none");
            window.location.href = `/hub/account/personality?role=${encodeURIComponent(roleTitle)}`;
          }}
        />
      )}
      {modal === "references" && (
        <ReferencesPaywallModal
          leadId={leadId}
          roleTitle={roleTitle}
          level={level}
          bundleEligible={bundleEligible}
          onClose={() => setModal("none")}
          onUnlocked={() => {
            setReferencesUnlockedState(true);
            setModal("none");
            window.location.href = "/hub/account/references";
          }}
        />
      )}
```

(Full-page navigation after unlock, not client-side `router.push`, so the destination page's own server-side data fetch runs fresh against the just-unlocked state — matches how `ReportPaywallModal`'s `onUnlocked` already just updates local state without navigating, since Report's content shows inline; Personality/References navigate to a separate page, so a fresh load avoids any server/client unlock-state mismatch.)

- [ ] **Step 3: Update `ProgressRail.tsx` gating logic**

Add `personalityUnlocked`/`referencesUnlocked` props, a `level: CandidateLevel` prop (import from `lib/razorpay/pricing.ts`, needed for price badges below), and `onOpenPersonalityPaywall`/`onOpenReferencesPaywall` callbacks. Change:

```ts
const isPersonalityLocked = isPersonalityStep && !personalityUnlocked;
const isReferencesLocked = isReferencesStep && !referencesUnlocked;
```

Update `isClickable` (line 140-143) to include `isPersonalityLocked || isReferencesLocked`. Update `isLinkable` (line 144-147) so personality/references are linkable **only when unlocked**:

```ts
const isLinkable =
  (isReferencesStep && referencesUnlocked) ||
  (isInterviewStep && interviewStatus === "ready") ||
  (isPersonalityStep && personalityUnlocked);
```

Update the `rightBadge` logic: when `isPersonalityLocked` or `isReferencesLocked`, show a price badge (same `₹{price}` pattern as `isReportLocked` at line 114-119) using `formatPrice(PRODUCT_PRICING.personality[level])`/`PRODUCT_PRICING.references[level]` — instead of the current unconditional "Start" text for personality, and instead of nothing for references. Update the final `onClick` branch (line 189-204) to call `onOpenPersonalityPaywall`/`onOpenReferencesPaywall` when locked.

- [ ] **Step 4: Manual verification**

`npm run dev`, load the dashboard as a test user with neither personality nor references unlocked: confirm both steps show a price badge (not "Start"), clicking either opens the correct new modal, completing a (bypass-mode) purchase navigates to the right page and the dashboard now shows that step unlocked/linkable on next load.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add app/hub/account/ProgressRail.tsx app/hub/account/page.tsx app/hub/account/DashboardClient.tsx
git commit -m "feat(hub): gate Personality and References steps behind payment on the dashboard"
```

---

### Task 6: `BundlePromoCard` — dashboard nudge

**Files:**
- Create: `app/hub/account/BundlePromoCard.tsx`
- Modify: `app/hub/account/DashboardClient.tsx`

**Interfaces:**
- Consumes: `bundleEligible: boolean`, `level: CandidateLevel` (already available in `DashboardClient`).
- Produces: opens the Report paywall modal (`setModal("report")`) — no new payment path.

- [ ] **Step 1: Write `BundlePromoCard.tsx`**

```tsx
"use client";

import { PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";

export default function BundlePromoCard({ level, onOpenPaywall }: { level: CandidateLevel; onOpenPaywall: () => void }) {
  const bundlePrice = PRODUCT_PRICING.bundle[level];
  const savings =
    PRODUCT_PRICING.report[level] + PRODUCT_PRICING.personality[level] + PRODUCT_PRICING.references[level] - bundlePrice;

  return (
    <div style={{ background: "#12121f", borderRadius: 14, padding: 18, margin: "0 0 18px" }}>
      <span
        className="font-[family-name:var(--font-poppins)] font-bold uppercase"
        style={{ fontSize: 10, letterSpacing: "0.06em", color: "#ed1a24", background: "rgba(237,26,36,0.15)", borderRadius: 50, padding: "3px 10px" }}
      >
        Save {formatPrice(savings)} · Best value
      </span>
      <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.1rem", margin: "10px 0 4px" }}>
        Get the Full Profile Bundle
      </p>
      <p style={{ color: "#c7c7cf", fontSize: 12.5, margin: "0 0 14px" }}>
        Report + Personality + References, bundled cheaper than buying separately.
      </p>
      <button
        onClick={onOpenPaywall}
        className="font-[family-name:var(--font-poppins)] font-semibold"
        style={{ background: "#fff", color: "#000", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13.5, cursor: "pointer" }}
      >
        Book my bundle — {formatPrice(bundlePrice)}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `DashboardClient.tsx`**

Insert right after `<ScoreCard ... />` (before `<CounsellingCard ... />`):

```tsx
          {bundleEligible && (
            <BundlePromoCard level={level} onOpenPaywall={() => setModal("report")} />
          )}
```

- [ ] **Step 3: Manual verification**

`npm run dev`, dashboard as a test user with `bundleEligible: true`: confirm the card renders between the score card and counselling card, price/savings match `PRODUCT_PRICING`, clicking opens the Report paywall (which now leads with bundle per Task 3).

- [ ] **Step 4: Run full suite + typecheck**

Run: `npm test && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add app/hub/account/BundlePromoCard.tsx app/hub/account/DashboardClient.tsx
git commit -m "feat(hub): add dashboard bundle promo card"
```

---

### Task 7: Interview bypass verification (not code)

- [ ] Confirm `RAZORPAY_BYPASS` is `false` in the actual production environment (Vercel dashboard or wherever deployed) — `.env.example` defaults it `true` for local dev convenience, but if it's also `true` in prod, Mock AI Interview is currently free for real users. This is a config check/fix, not a code change; flag to the user if found `true`.

## Verification

- `npm test && npx tsc --noEmit` clean after every task.
- Manual dashboard walkthrough as a test user with nothing unlocked: only "Job fitment score" shows free/done; Report, Personality, References all show price badges; clicking each opens the correct paywall; Personality/References paywalls show the bundle-leads layout when `bundleEligible`; bundle purchase unlocks all three; solo purchase unlocks just the one clicked.
- Confirm hitting `/api/hub/save-personality-test` and `/api/hub/references/initiate` directly (e.g. via curl, unpaid test user, `RAZORPAY_BYPASS=false`) returns 402 — the real enforcement point, not just the UI gate.
