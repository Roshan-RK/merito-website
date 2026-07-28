import { describe, it, expect } from "vitest";
import { getCriteriaStatusColor } from "../criteriaStatus";

describe("getCriteriaStatusColor", () => {
  it("colors Matched green", () => {
    expect(getCriteriaStatusColor("Matched")).toBe("#16803c");
  });

  it("colors Partially Matched amber, distinct from both Matched and Not Matched", () => {
    const partial = getCriteriaStatusColor("Partially Matched");
    expect(partial).toBe("#d97706");
    expect(partial).not.toBe(getCriteriaStatusColor("Matched"));
    expect(partial).not.toBe(getCriteriaStatusColor("Not Matched"));
  });

  it("colors Not Matched red", () => {
    expect(getCriteriaStatusColor("Not Matched")).toBe("#ed1a24");
  });
});
