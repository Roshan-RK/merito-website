# Merito HUB — Full paywall coverage + bundle-first nudging

## Context

`specs/2026-07-24-hub-bundle-pricing-ui-design.md` built the backend (`product_unlocks` table, `isProductUnlocked`, `finalize.ts` cases, generic initiate route allowing `personality`/`references`) and the shared `PriceOptionTiles` component, wired into `ReportPaywallModal` only. It explicitly left `PersonalityPaywallModal`/`ReferencesPaywallModal` **out of scope**.

Right now only "Detailed report" is actually paywalled on the dashboard. Personality test and Reference checks are plain `Link`s with no gate at all — free, unconditionally, both client and server side. Mock AI interview has a real gate but is subject to `RAZORPAY_BYPASS` (defaults `true` in `.env.example`).

**Why:** every step except the free first-step fitment score should require payment — currently two of five steps aren't gated at all. Separately, bundle uptake is being left on the table: the bundle option only ever appears as an equal-weight tile next to solo inside a modal the user has to already click into.

## Scope

1. Real paywalls for Personality and References (UI + server-side enforcement).
2. Redesign `PriceOptionTiles`' bundle-eligible layout: bundle leads as the primary card, solo becomes a secondary text link (previously: two equal tiles).
3. A dashboard promo card surfacing the bundle before any paywall click.
4. Verify (not fix, unless broken) that Interview's existing gate is actually enforced in production.

Out of scope: Interview/Counselling paywall UI changes (confirmed: they stay solo-price-only, not part of the bundle), any change to the bundle's product composition (still report+personality+references), the reference-check *process* itself once unlocked (referee flow unchanged).

## Components

### 1. `PriceOptionTiles.tsx` — bundle-leads redesign

Same props, same eligibility logic, same pricing source (`PRODUCT_PRICING`/`formatPrice`) — only the `bundleEligible` branch's JSX changes:

- Bundle renders as one primary card (dark `#12121f` background, matching `BundlePromoCard` below): "RECOMMENDED · Save ₹X" badge, bundle price, "Includes: Detailed Report + Personality Test + Reference Checks", full-width CTA button.
- Solo option becomes a single underlined text line below the card: `Just {soloLabel} for ₹{soloPrice} instead →`, clicking it calls `onContinue("solo")` directly (no separate confirm step).
- Default/only path when `onContinue` fires from the primary card is `"bundle"` — no more manual tile-selection state needed, so the component's internal `useState<"solo"|"bundle">` selection state goes away entirely; `onContinue` is called directly by whichever element (card or link) was clicked.
- Non-bundle-eligible branch (single button) unchanged.

### 2. `PersonalityPaywallModal.tsx`, `ReferencesPaywallModal.tsx` (new)

Mirror `InterviewPaywallModal.tsx`'s structure exactly (generic `/api/hub/razorpay/initiate` → Razorpay checkout script → `/api/hub/razorpay/verify`), but replace the single price button with `<PriceOptionTiles soloProduct="personality|references" ... onContinue={handlePay} />`, where `handlePay(selection)` passes `product: selection === "bundle" ? "bundle" : "personality"` (or `"references"`) to the initiate call. On success:
- Personality: call `onUnlocked()` → parent navigates to `/hub/account/personality?role=...` (same destination the old free `Link` pointed to).
- References: call `onUnlocked()` → parent navigates to wherever "Start" currently points for references (confirm exact route in planning — likely `/hub/account/references`).
- If `selection === "bundle"`, the initiate call's `product: "bundle"` needs a `leadId` (per the existing spec's note that bundle unlocks are lead-scoped via `unlock-report`'s route, not the generic initiate route). **Flag for planning:** confirm whether the generic initiate route's `bundle` handling already exists or whether bundle purchase must route through `/api/hub/unlock-report` regardless of which paywall triggered it — this determines whether these two new modals need a `leadId` prop.

### 3. `ProgressRail.tsx` — real gating for Personality and References

Both steps stop being unconditional `Link`s. Add `isPersonalityLocked`/`isReferencesLocked` (mirroring `isReportLocked` at line 81) computed from `isProductUnlocked`, passed down from the server component that already fetches `bundleEligible`. Locked click opens the corresponding new modal (via `onOpenPersonalityPaywall`/`onOpenReferencesPaywall` callbacks, same pattern as `onOpenReportPaywall`/`onOpenInterviewStart` in `DashboardClient.tsx:113-136`) instead of navigating.

### 4. Server-side enforcement (the real gate — UI gating alone is bypassable)

- `app/api/hub/save-personality-test/route.ts` — add an `isProductUnlocked(user.id, "personality")` check before the upsert (after the existing auth check at line 13-15), 402 if not unlocked. Mirrors `start-ai-interview`'s existing bypassable-via-`RAZORPAY_BYPASS` pattern for consistency.
- References — **flag for planning:** find the actual write/trigger route (`app/api/hub/references/initiate/route.ts` is the likely candidate per this session's grep, needs confirmation) and add the same check.
- Both respect `RAZORPAY_BYPASS` the same way `start-ai-interview` already does, for dev/test convenience — not a new bypass mechanism.

### 5. `BundlePromoCard.tsx` (new)

Dashboard card, black `#12121f` background matching the existing "1:1 Guidance" card's visual weight, placed in `DashboardClient.tsx` right after `ScoreCard` (before `CounsellingCard`). Shown when `bundleEligible` (same server-computed flag already passed to `ReportPaywallModal`) and the user hasn't unlocked everything already. Content: "SAVE ₹X · BEST VALUE" badge, "Get the Full Profile Bundle", one-line contents list, CTA. Clicking opens `ReportPaywallModal` (reused, not a new payment path) — since `PriceOptionTiles` now defaults to leading with bundle, no extra prop needed to "pre-select" bundle; it's already the primary action.

### 6. Interview bypass verification

Not a code task — confirm `RAZORPAY_BYPASS` is `false` in the actual production environment (Vercel or wherever it's deployed). If it's already `false`, nothing to do. If `true` in prod, that's a config fix, not a code change, and should happen before/alongside this work ships — flagging so it isn't silently forgotten.

## Testing

- `PriceOptionTiles` — update existing tests (if any) for the new bundle-leads layout; new test asserting solo-link click still calls `onContinue("solo")`.
- New route-level tests for `save-personality-test`'s unlock check and the references write route's unlock check, mirroring `start-ai-interview`'s existing unlock-check test pattern.
- `PersonalityPaywallModal`/`ReferencesPaywallModal` get the same test treatment `InterviewPaywallModal` has today (confirm what that is during planning).
- Manual/visual verification of `BundlePromoCard` and the redesigned `PriceOptionTiles` against a real dashboard (screenshot, same approach as this session's earlier skill-wise-table verification).

## Non-goals

- No change to bundle composition, pricing values, or the `finalize.ts`/`unlock-report` backend logic beyond what's needed to make the two new modals actually initiate a purchase (see flagged open question in §2).
- No Interview or Counselling paywall UI changes.
- No new payment gateway logic — everything routes through the existing Razorpay checkout/verify flow.
