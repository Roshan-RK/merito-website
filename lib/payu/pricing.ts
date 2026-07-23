export type CandidateLevel = "entry" | "mid" | "senior";
export type PayuProduct = "report" | "personality" | "references" | "interview" | "counselling" | "bundle";

export const DEFAULT_LEVEL: CandidateLevel = "entry";

// Personality's "bundle rate" (charged only when bought as part of the
// report+personality+references bundle) lives in PRODUCT_PRICING.bundle,
// not here — this table is each product's own solo price.
export const PRODUCT_PRICING: Record<PayuProduct, Record<CandidateLevel, number>> = {
  report: { entry: 29900, mid: 29900, senior: 29900 },
  personality: { entry: 34900, mid: 99900, senior: 149900 },
  references: { entry: 29900, mid: 49900, senior: 49900 },
  interview: { entry: 99900, mid: 99900, senior: 149900 },
  counselling: { entry: 199900, mid: 199900, senior: 299900 },
  // report + personality(bundle rate) + references, per level:
  // entry 299+299+299=897, mid 299+499+499=1297, senior 299+999+499=1797
  bundle: { entry: 89700, mid: 129700, senior: 179700 },
};

export const PRODUCT_LABELS: Record<PayuProduct, string> = {
  report: "Detailed Report",
  personality: "Personality Test",
  references: "Reference Checks",
  interview: "Mock AI Interview",
  counselling: "1:1 Counselling Session",
  bundle: "Full Profile Bundle",
};

export function formatPrice(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}
