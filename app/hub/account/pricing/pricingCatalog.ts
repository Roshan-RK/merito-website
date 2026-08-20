import { PRODUCT_PRICING, PRODUCT_LABELS, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";
import { MIN_REFERENCES } from "@/lib/referenceChecks";

export type PricingCardKey = "report" | "personality" | "references" | "interview" | "counselling";

const CARD_ORDER: PricingCardKey[] = ["report", "personality", "references", "interview", "counselling"];

// Only report/personality/references are ever bought as the bundle -- interview
// and counselling are always solo purchases. Mirrors PriceOptionTiles.tsx /
// BundlePromoCard.tsx, which apply the same split.
const IN_BUNDLE: Record<PricingCardKey, boolean> = {
  report: true,
  personality: true,
  references: true,
  interview: false,
  counselling: false,
};

// Short, factual descriptions grounded in what each product actually does in
// this codebase (not the mockup's copy, which describes things this build
// doesn't have -- e.g. a fixed-length interview, or exactly 2 references).
const DESCRIPTIONS: Record<PricingCardKey, string> = {
  report: "A detailed breakdown of your fitment score, skill gaps, and CV fixes for this role.",
  personality: "A Big Five (OCEAN) questionnaire mapping how you think, work, and relate to others, matched to your role.",
  references: `We verify at least ${MIN_REFERENCES} professional references you provide and compile their feedback into your profile.`,
  interview: "An AI-run mock interview matched to your role, with a scored performance report you can practise against.",
  counselling: "A Merito career expert reviews your fitment, personality, and interview results, then gives you a straight, personalised plan.",
};

export type PricingCard = {
  key: PricingCardKey;
  label: string;
  description: string;
  price: number;
  priceLabel: string;
  bundlePrice: number | null;
  bundlePriceLabel: string | null;
  inBundle: boolean;
};

// Personality is the only product whose price actually changes inside the
// bundle (report/references stay at solo price either way -- see the bundle
// total's own comment in lib/razorpay/pricing.ts). Its bundle-rate isn't
// stored on its own; it's the remainder once report+references are subtracted
// from the bundle total, same arithmetic PriceOptionTiles/BundlePromoCard use
// for the savings figure, just solved for the one varying term instead.
export function getPersonalityBundleRate(level: CandidateLevel): number {
  return PRODUCT_PRICING.bundle[level] - PRODUCT_PRICING.report[level] - PRODUCT_PRICING.references[level];
}

export function buildPricingCards(level: CandidateLevel): PricingCard[] {
  return CARD_ORDER.map((key) => {
    const price = PRODUCT_PRICING[key][level];
    const bundlePrice = key === "personality" ? getPersonalityBundleRate(level) : null;
    return {
      key,
      label: PRODUCT_LABELS[key],
      description: DESCRIPTIONS[key],
      price,
      priceLabel: formatPrice(price),
      bundlePrice,
      bundlePriceLabel: bundlePrice != null ? formatPrice(bundlePrice) : null,
      inBundle: IN_BUNDLE[key],
    };
  });
}

export type BundleSummary = {
  bundlePrice: number;
  bundlePriceLabel: string;
  soloTotal: number;
  soloTotalLabel: string;
  savings: number;
  savingsLabel: string;
};

export function buildBundleSummary(level: CandidateLevel): BundleSummary {
  const bundlePrice = PRODUCT_PRICING.bundle[level];
  const soloTotal = PRODUCT_PRICING.report[level] + PRODUCT_PRICING.personality[level] + PRODUCT_PRICING.references[level];
  const savings = soloTotal - bundlePrice;
  return {
    bundlePrice,
    bundlePriceLabel: formatPrice(bundlePrice),
    soloTotal,
    soloTotalLabel: formatPrice(soloTotal),
    savings,
    savingsLabel: formatPrice(savings),
  };
}
