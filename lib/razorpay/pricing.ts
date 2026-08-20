export type CandidateLevel = "entry" | "mid" | "senior";
export type RazorpayProduct = "report" | "personality" | "references" | "interview" | "counselling" | "bundle";

export const DEFAULT_LEVEL: CandidateLevel = "entry";

// report/personality/references are flat ₹299 solo at every level; the
// bundle is a flat ₹749 discount off their 897 combined solo total. Interview
// and counselling still scale by level.
export const PRODUCT_PRICING: Record<RazorpayProduct, Record<CandidateLevel, number>> = {
  report: { entry: 29900, mid: 29900, senior: 29900 },
  personality: { entry: 29900, mid: 29900, senior: 29900 },
  references: { entry: 29900, mid: 29900, senior: 29900 },
  interview: { entry: 99900, mid: 99900, senior: 149900 },
  counselling: { entry: 199900, mid: 199900, senior: 299900 },
  bundle: { entry: 74900, mid: 74900, senior: 74900 },
};

export const PRODUCT_LABELS: Record<RazorpayProduct, string> = {
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
