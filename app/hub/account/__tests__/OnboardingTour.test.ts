import { describe, it, expect } from "vitest";
import { TOUR_STEPS, findVisibleStepIndex, computeTooltipPlacement } from "../OnboardingTour";

describe("TOUR_STEPS", () => {
  it("starts with the fitment score and ends with the consolidated report nav link", () => {
    expect(TOUR_STEPS[0].target).toBe("score");
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].target).toBe("nav-consolidated");
  });

  it("drops the mockup's app-switcher and search steps -- neither feature exists in this app", () => {
    const targets = TOUR_STEPS.map((s) => s.target);
    expect(targets).not.toContain("app-switcher");
    expect(targets).not.toContain("search");
  });

  it("covers all 4 ProgressRail pills plus score, guidance, bundle, and consolidated report", () => {
    const targets = TOUR_STEPS.map((s) => s.target);
    expect(targets).toEqual([
      "score",
      "pill-report",
      "pill-personality",
      "pill-references",
      "pill-interview",
      "guidance",
      "bundle",
      "nav-consolidated",
    ]);
  });

  it("gives every step a non-empty title and body", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });
});

describe("findVisibleStepIndex", () => {
  const steps = TOUR_STEPS;
  const allPresent = () => true;

  it("returns fromIndex unchanged when that step's target is present", () => {
    expect(findVisibleStepIndex(steps, 2, 1, allPresent)).toBe(2);
  });

  it("skips forward over a missing target (e.g. bundle, when not bundle-eligible)", () => {
    const bundleIndex = steps.findIndex((s) => s.target === "bundle");
    const isPresent = (target: string) => target !== "bundle";
    expect(findVisibleStepIndex(steps, bundleIndex, 1, isPresent)).toBe(bundleIndex + 1);
  });

  it("skips backward over a missing target when navigating with Back", () => {
    const bundleIndex = steps.findIndex((s) => s.target === "bundle");
    const isPresent = (target: string) => target !== "bundle";
    expect(findVisibleStepIndex(steps, bundleIndex, -1, isPresent)).toBe(bundleIndex - 1);
  });

  it("returns an out-of-range index when nothing ahead is present, signalling the tour should close", () => {
    const isPresent = () => false;
    const result = findVisibleStepIndex(steps, 0, 1, isPresent);
    expect(result).toBe(steps.length);
  });

  it("returns a negative index when nothing behind is present", () => {
    const isPresent = () => false;
    const result = findVisibleStepIndex(steps, steps.length - 1, -1, isPresent);
    expect(result).toBe(-1);
  });
});

describe("computeTooltipPlacement", () => {
  it("places the card below the target when there's enough room beneath it", () => {
    const rect = { top: 100, bottom: 160, left: 200 };
    const placement = computeTooltipPlacement(rect, 1280, 900);
    expect(placement.top).toBe(176);
    expect(placement.bottom).toBeUndefined();
  });

  it("places the card above the target when there isn't enough room beneath it", () => {
    const rect = { top: 750, bottom: 800, left: 200 };
    const placement = computeTooltipPlacement(rect, 1280, 900);
    expect(placement.bottom).toBe(166);
    expect(placement.top).toBeUndefined();
  });

  it("clamps left so the card never runs off the right edge of the viewport", () => {
    const rect = { top: 100, bottom: 160, left: 1200 };
    const placement = computeTooltipPlacement(rect, 1280, 900, 320);
    expect(placement.left).toBe(1280 - 320 - 20);
  });

  it("clamps left so the card never runs off the left edge of the viewport", () => {
    const rect = { top: 100, bottom: 160, left: -50 };
    const placement = computeTooltipPlacement(rect, 1280, 900);
    expect(placement.left).toBe(16);
  });
});
