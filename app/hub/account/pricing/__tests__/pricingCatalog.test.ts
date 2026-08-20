import { describe, it, expect } from "vitest";
import { buildPricingCards, buildBundleSummary, getPersonalityBundleRate } from "../pricingCatalog";

describe("getPersonalityBundleRate", () => {
  it("derives entry-level personality bundle rate from bundle total minus report/references", () => {
    expect(getPersonalityBundleRate("entry")).toBe(29900); // ₹299
  });

  it("derives mid-level personality bundle rate", () => {
    expect(getPersonalityBundleRate("mid")).toBe(49900); // ₹499
  });

  it("derives senior-level personality bundle rate", () => {
    expect(getPersonalityBundleRate("senior")).toBe(99900); // ₹999
  });
});

describe("buildPricingCards", () => {
  it("returns all five products in a stable order", () => {
    const cards = buildPricingCards("entry");
    expect(cards.map((c) => c.key)).toEqual(["report", "personality", "references", "interview", "counselling"]);
  });

  it("marks report/personality/references as bundle-eligible and interview/counselling as not", () => {
    const cards = buildPricingCards("entry");
    const inBundle = Object.fromEntries(cards.map((c) => [c.key, c.inBundle]));
    expect(inBundle).toEqual({
      report: true,
      personality: true,
      references: true,
      interview: false,
      counselling: false,
    });
  });

  it("only personality carries a bundlePrice", () => {
    const cards = buildPricingCards("mid");
    for (const card of cards) {
      if (card.key === "personality") {
        expect(card.bundlePrice).toBe(49900);
        expect(card.bundlePriceLabel).toBe("₹499");
      } else {
        expect(card.bundlePrice).toBeNull();
        expect(card.bundlePriceLabel).toBeNull();
      }
    }
  });

  it("formats solo prices from the real pricing table for senior level", () => {
    const cards = buildPricingCards("senior");
    const byKey = Object.fromEntries(cards.map((c) => [c.key, c.priceLabel]));
    expect(byKey).toEqual({
      report: "₹299",
      personality: "₹1499",
      references: "₹499",
      interview: "₹1499",
      counselling: "₹2999",
    });
  });
});

describe("buildBundleSummary", () => {
  it("computes entry-level savings", () => {
    const summary = buildBundleSummary("entry");
    expect(summary).toEqual({
      bundlePrice: 89700,
      bundlePriceLabel: "₹897",
      soloTotal: 94700,
      soloTotalLabel: "₹947",
      savings: 5000,
      savingsLabel: "₹50",
    });
  });

  it("computes mid-level savings", () => {
    const summary = buildBundleSummary("mid");
    expect(summary.savingsLabel).toBe("₹500");
  });

  it("computes senior-level savings", () => {
    const summary = buildBundleSummary("senior");
    expect(summary.savingsLabel).toBe("₹500");
  });
});
