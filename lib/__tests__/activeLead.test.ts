import { describe, it, expect } from "vitest";
import { resolveActiveLead } from "../activeLead";

type FakeLead = { id: string; role_title: string };

const leads: FakeLead[] = [
  { id: "lead-2", role_title: "Senior Backend Engineer" },
  { id: "lead-1", role_title: "Backend Engineer" },
];

describe("resolveActiveLead", () => {
  it("returns the lead matching leadIdOverride when present", () => {
    expect(resolveActiveLead(leads, "lead-1")).toEqual(leads[1]);
  });

  it("returns leads[0] when leadIdOverride is undefined", () => {
    expect(resolveActiveLead(leads, undefined)).toEqual(leads[0]);
  });

  it("returns leads[0] when no argument provided", () => {
    expect(resolveActiveLead(leads)).toEqual(leads[0]);
  });

  it("returns leads[0] when leadIdOverride does not match any lead", () => {
    expect(resolveActiveLead(leads, "lead-does-not-exist")).toEqual(leads[0]);
  });

  it("throws when leads is empty", () => {
    expect(() => resolveActiveLead([], "lead-1")).toThrow();
  });
});
