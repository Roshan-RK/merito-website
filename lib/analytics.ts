/**
 * Thin wrapper over the GTM dataLayer. GTM (loaded in app/layout.tsx) is the
 * only analytics transport; from there marketing maps these events onto GA4,
 * the Meta pixel, and the LinkedIn Insight Tag. Keep event names stable -- they
 * are the contract with the GTM container.
 *
 * Funnel events (see the Sept 2026 CRO plan, section 16):
 *   cta_click        - any primary "check your fitment" / "request a session" CTA
 *   score_start      - fitment form meaningfully started
 *   score_complete   - fitment score returned successfully
 *   score_error      - fitment submission failed
 *   <product>_purchase - a paid unlock verified by Razorpay
 */

type Params = Record<string, unknown>;

type DataLayerWindow = Window & { dataLayer?: unknown[] };

export function track(event: string, params: Params = {}): void {
  if (typeof window === "undefined") return;
  const w = window as DataLayerWindow;
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  w.dataLayer.push({ event, ...params });
}

const PURCHASE_EVENT: Record<string, string> = {
  report: "report_purchase",
  bundle: "bundle_purchase",
  personality: "personality_purchase",
  references: "references_purchase",
  interview: "interview_purchase",
  counselling: "expert_purchase",
};

/** Fire after Razorpay verification succeeds. `product` is the value sent to the initiate/unlock endpoint. */
export function trackPurchase(product: string, params: Params = {}): void {
  track(PURCHASE_EVENT[product] ?? "purchase", { product, ...params });
}
