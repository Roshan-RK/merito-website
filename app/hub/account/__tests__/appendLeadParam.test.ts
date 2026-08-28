import { describe, it, expect } from "vitest";
import { appendLeadParam } from "../useLeadHref";

describe("appendLeadParam", () => {
  it("no lead -> path unchanged", () => expect(appendLeadParam("/hub/account/report", null)).toBe("/hub/account/report"));
  it("lead, no existing query -> ?lead=", () => expect(appendLeadParam("/hub/account/report", "x")).toBe("/hub/account/report?lead=x"));
  it("lead, existing query -> &lead=", () => expect(appendLeadParam("/hub/account/report?tab=cv", "x")).toBe("/hub/account/report?tab=cv&lead=x"));
  it("path already has lead= -> not doubled", () => expect(appendLeadParam("/hub/account/report?lead=old", "x")).toBe("/hub/account/report?lead=old"));
});
