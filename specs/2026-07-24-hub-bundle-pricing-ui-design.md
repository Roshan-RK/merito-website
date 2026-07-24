# Merito HUB — Bundle-aware pricing UI

## Context

`lib/razorpay/pricing.ts` already has tiered solo and bundle pricing
(`entry|mid|senior`) for all five products, and `ReportPaywallModal` +
`CounsellingCard`/`CounsellingPaywallModal` already show a single price and
"Continue to payment" CTA per product. There is no UI anywhere that shows a
candidate the bundle price alongside a solo price — `bundle` only exists as a
pricing-table entry and a `finalize.ts` code path today. This spec adds that
UI, for the three products the bundle actually covers.

**Why:** candidates on different `candidate_level` tiers see different solo
prices already; the missing piece is showing them the bundle is cheaper
before they commit to a solo purchase, driving bundle uptake.

## Scope

Bundle = Report + Personality + References (per
`specs/2026-07-23-hub-payu-integration-design.md`). Only these three
products' paywalls change. Interview and Counselling are consumable,
pay-per-use products outside the bundle — their paywalls stay solo-price-only,
unchanged.

## Component: `PriceOptionTiles`

New shared component, `app/hub/account/PriceOptionTiles.tsx`, rendered inside
each of the three product paywall modals (`ReportPaywallModal` today;
`PersonalityPaywallModal` and `ReferencesPaywallModal` follow the same
`CounsellingCard`/`CounsellingPaywallModal` pattern once built) in place of
today's single price line + button. Each modal keeps its own header copy and
sample-preview content — only the price/CTA block is replaced.

**Props:**
```ts
{
  soloProduct: "report" | "personality" | "references";
  soloLabel: string;          // e.g. "Just the Report"
  level: CandidateLevel;      // from lib/razorpay/pricing.ts
  bundleEligible: boolean;    // server-computed, see Eligibility below
  onContinue: (selection: "solo" | "bundle") => void;
  submitting: boolean;
}
```

Prices are read directly from `PRODUCT_PRICING`/`formatPrice` in
`lib/razorpay/pricing.ts` — no new pricing logic. Savings shown on the bundle
tile = `PRODUCT_PRICING.report[level] + PRODUCT_PRICING.personality[level] + PRODUCT_PRICING.references[level] - PRODUCT_PRICING.bundle[level]`.

**Layout:** two tiles, side by side on desktop (`flex-direction: row`), stacked
on mobile (`flex-direction: column` under a breakpoint, matching the
project's existing informal mobile stacking elsewhere — no new breakpoint
system introduced).

- **Solo tile:** `{soloLabel}` · price, e.g. "Just the Report · ₹299".
- **Bundle tile:** "Full Bundle · ₹897" + a "Save ₹697" badge (`#16803c`
  green, matching the existing "done" state color already used in
  `ProgressRail`) + one line: "Includes: Detailed Report + Personality Test +
  Reference Checks."
- Selected tile gets a red border (`#ed1a24`, 2px) — same visual language as
  the existing CV-upload selected-state border in `FitmentChecker.tsx`
  (`border: 1.5px dashed #22c55e` when a file is chosen — same idea, red
  instead of green since this is a selection not a completion state).
- Unselected tile: `#dcdcdc` border, no shadow.
- Default selection: **bundle** (nudges toward the better-value option, and
  it's the cheaper price so defaulting to it is honest, not dark-pattern).
- Clicking a tile only changes selection state — no layout reflow, no
  re-fetch.

**CTA:** one button below both tiles: `Continue to payment — ₹{selected
price}`, price text updates live as selection changes. Calls
`onContinue(selection)`; the parent modal (which already owns the
Razorpay-checkout logic per `ReportPaywallModal`) maps that to the right
`product` value (`"report" | "personality" | "references" | "bundle"`) when
calling the initiate route.

**If `bundleEligible` is false:** render only the solo tile (full width, no
side-by-side layout, no selection state needed) — visually identical to
today's single-price block, just using the same component so there's one
code path instead of two.

## Eligibility

A product's paywall page (server component / route that renders the modal)
computes `bundleEligible` before rendering:

```
bundleEligible = !personalityUnlocked && !referencesUnlocked
```

Both flags come from the existing `product_unlocks` table
(`personality`/`references` rows), the same source `finalize.ts` already
writes to. This matches the existing spec's rule: bundling only makes sense
before either of the other two products has been separately bought. Report's
own per-lead unlock status is irrelevant to this check (a candidate can
re-buy a solo report for a new role after already owning the bundle, and
should just see the solo tile then, correctly excluded since bundle would
duplicate what they already own).

This check is server-side, computed where each modal's data is already
fetched (matching the existing spec's "enforcement is server-side, not just
UI-side" rule) — the client never decides eligibility itself, it only renders
what the server already decided.

## Non-goals

- No changes to `Interview` or `Counselling` paywalls — solo-price-only,
  unchanged.
- No changes to backend payment initiation, webhook, or finalize logic —
  `bundle` is already a first-class `product` value in
  `lib/razorpay/pricing.ts` and `lib/razorpay/finalize.ts`; this spec only
  adds the UI that lets a candidate choose it from the Report/Personality/
  References paywalls instead of it being unreachable from those entry
  points.
- `PersonalityPaywallModal` and `ReferencesPaywallModal` do not exist yet.
  Building them is out of scope here — this spec only defines the shared
  `PriceOptionTiles` piece they'll both use once built, and retrofits
  `ReportPaywallModal` to use it now.
