import { describe, it, expect } from "vitest";
import { buildPricingCards, buildBundleSummary, getPersonalityBundleRate } from "../pricingCatalog";

describe("getPersonalityBundleRate", () => {
  it("derives entry-level personality bundle rate from bundle total minus report/references", () => {
    expect(getPersonalityBundleRate("entry")).toBe(15100); // ₹151
  });

  it("derives mid-level personality bundle rate", () => {
    expect(getPersonalityBundleRate("mid")).toBe(15100); // ₹151
  });

  it("derives senior-level personality bundle rate", () => {
    expect(getPersonalityBundleRate("senior")).toBe(15100); // ₹151
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
        expect(card.bundlePrice).toBe(15100);
        expect(card.bundlePriceLabel).toBe("₹151");
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
      personality: "₹299",
      references: "₹299",
      interview: "₹1499",
      counselling: "₹2999",
    });
  });
});

describe("buildBundleSummary", () => {
  it("computes entry-level savings", () => {
    const summary = buildBundleSummary("entry");
    expect(summary).toEqual({
      bundlePrice: 74900,
      bundlePriceLabel: "₹749",
      soloTotal: 89700,
      soloTotalLabel: "₹897",
      savings: 14800,
      savingsLabel: "₹148",
    });
  });

  it("computes mid-level savings", () => {
    const summary = buildBundleSummary("mid");
    expect(summary.savingsLabel).toBe("₹148");
  });

  it("computes senior-level savings", () => {
    const summary = buildBundleSummary("senior");
    expect(summary.savingsLabel).toBe("₹148");
  });
});
