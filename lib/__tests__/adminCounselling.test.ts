import { describe, it, expect } from "vitest";
import { nextCounsellingState } from "../adminCounselling";

const NOW = "2026-08-05T12:00:00Z";

describe("nextCounsellingState", () => {
  it("requested -> scheduled sets scheduled_at", () => {
    const result = nextCounsellingState("requested", "scheduled", NOW);
    expect(result).toEqual({ status: "scheduled", scheduled_at: NOW });
  });

  it("requested -> cancelled sets only status", () => {
    const result = nextCounsellingState("requested", "cancelled", NOW);
    expect(result).toEqual({ status: "cancelled" });
  });

  it("scheduled -> completed sets completed_at", () => {
    const result = nextCounsellingState("scheduled", "completed", NOW);
    expect(result).toEqual({ status: "completed", completed_at: NOW });
  });

  it("scheduled -> cancelled sets only status", () => {
    const result = nextCounsellingState("scheduled", "cancelled", NOW);
    expect(result).toEqual({ status: "cancelled" });
  });

  it("scheduled -> requested clears scheduled_at", () => {
    const result = nextCounsellingState("scheduled", "requested", NOW);
    expect(result).toEqual({ status: "requested", scheduled_at: null });
  });

  it("throws on requested -> completed (skips scheduling)", () => {
    expect(() => nextCounsellingState("requested", "completed", NOW)).toThrow(/invalid transition/i);
  });

  it("throws on completed -> anything (terminal)", () => {
    expect(() => nextCounsellingState("completed", "scheduled", NOW)).toThrow(/invalid transition/i);
    expect(() => nextCounsellingState("completed", "requested", NOW)).toThrow(/invalid transition/i);
  });

  it("throws on cancelled -> anything (terminal)", () => {
    expect(() => nextCounsellingState("cancelled", "requested", NOW)).toThrow(/invalid transition/i);
    expect(() => nextCounsellingState("cancelled", "scheduled", NOW)).toThrow(/invalid transition/i);
  });

  it("throws on no-op transitions (same status)", () => {
    expect(() => nextCounsellingState("requested", "requested", NOW)).toThrow(/invalid transition/i);
    expect(() => nextCounsellingState("scheduled", "scheduled", NOW)).toThrow(/invalid transition/i);
  });
});
