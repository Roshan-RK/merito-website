import { describe, it, expect } from "vitest";
import { resolveSwitcherState } from "../roleSwitcher";

const A = { id: "a", role_title: "Consultant", score: 6.9 };
const B = { id: "b", role_title: "Analyst", score: 7.9 };

describe("resolveSwitcherState", () => {
  it("no leads -> null active, no dropdown", () => {
    expect(resolveSwitcherState([], null)).toEqual({ activeLead: null, showDropdown: false });
  });
  it("one lead -> that lead active, no dropdown", () => {
    expect(resolveSwitcherState([A], null)).toEqual({ activeLead: A, showDropdown: false });
  });
  it("2+ leads, no param -> leads[0] active, dropdown shown", () => {
    expect(resolveSwitcherState([A, B], null)).toEqual({ activeLead: A, showDropdown: true });
  });
  it("2+ leads, valid param -> that lead active", () => {
    expect(resolveSwitcherState([A, B], "b")).toEqual({ activeLead: B, showDropdown: true });
  });
  it("2+ leads, unknown param -> falls back to leads[0]", () => {
    expect(resolveSwitcherState([A, B], "zzz")).toEqual({ activeLead: A, showDropdown: true });
  });
});
