import { describe, it, expect } from "vitest";
import { computeFunnelStage } from "../adminCandidates";

const emptySets = () => ({
  reportUnlocked: new Set<string>(),
  interviewReady: new Set<string>(),
  personalityCompleted: new Set<string>(),
  referenceCompleted: new Set<string>(),
});

describe("computeFunnelStage", () => {
  it("returns fitment_started when present in no other set", () => {
    expect(computeFunnelStage("u1", emptySets())).toBe("fitment_started");
  });

  it("returns report_unlocked when only in that set", () => {
    const sets = emptySets();
    sets.reportUnlocked.add("u1");
    expect(computeFunnelStage("u1", sets)).toBe("report_unlocked");
  });

  it("returns personality_completed when personality done but interview was skipped", () => {
    const sets = emptySets();
    sets.reportUnlocked.add("u1");
    sets.personalityCompleted.add("u1");
    expect(computeFunnelStage("u1", sets)).toBe("personality_completed");
  });

  it("returns reference_completed when present, regardless of other sets", () => {
    const sets = emptySets();
    sets.referenceCompleted.add("u1");
    expect(computeFunnelStage("u1", sets)).toBe("reference_completed");
  });

  it("picks the furthest stage when candidate is in multiple non-adjacent sets", () => {
    const sets = emptySets();
    sets.reportUnlocked.add("u1");
    sets.referenceCompleted.add("u1");
    expect(computeFunnelStage("u1", sets)).toBe("reference_completed");
  });

  it("ignores membership belonging to a different user", () => {
    const sets = emptySets();
    sets.referenceCompleted.add("u2");
    expect(computeFunnelStage("u1", sets)).toBe("fitment_started");
  });
});
