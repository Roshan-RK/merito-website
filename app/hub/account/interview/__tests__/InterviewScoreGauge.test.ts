import { describe, it, expect } from "vitest";
import { getScoreBand } from "../InterviewScoreGauge";

describe("getScoreBand", () => {
  it("bands the bottom of the 0-100 range as Needs work (red)", () => {
    expect(getScoreBand(0)).toEqual({ label: "Needs work", textColor: "#ed1a24", trackColor: "#fdeced" });
  });

  it("bands just under the Developing threshold as Needs work", () => {
    expect(getScoreBand(39).label).toBe("Needs work");
  });

  it("bands the Developing threshold as Developing (gray)", () => {
    expect(getScoreBand(40)).toEqual({ label: "Developing", textColor: "#4b4b4d", trackColor: "#f0e6ea" });
  });

  it("bands just under the Strong threshold as Developing", () => {
    expect(getScoreBand(69).label).toBe("Developing");
  });

  it("bands the Strong threshold as Strong (green)", () => {
    expect(getScoreBand(70)).toEqual({ label: "Strong", textColor: "#16803c", trackColor: "#eefdf1" });
  });

  it("bands the top of the range as Strong", () => {
    expect(getScoreBand(100).label).toBe("Strong");
  });
});
