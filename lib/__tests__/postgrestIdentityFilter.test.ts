import { describe, it, expect } from "vitest";
import { leadIdOrRoleTitleFilter, fitmentLeadIdOrRoleTitleFilter } from "../postgrestIdentityFilter";

describe("leadIdOrRoleTitleFilter", () => {
  it("quotes a plain role title", () => {
    expect(leadIdOrRoleTitleFilter("lead-1", "Senior Product Manager")).toBe(
      'lead_id.eq.lead-1,role_title.eq."Senior Product Manager"'
    );
  });

  it("does not let a comma in role_title split into an extra clause", () => {
    expect(leadIdOrRoleTitleFilter("lead-1", "Manager, Growth")).toBe(
      'lead_id.eq.lead-1,role_title.eq."Manager, Growth"'
    );
  });

  it("escapes a double quote in role_title", () => {
    expect(leadIdOrRoleTitleFilter("lead-1", 'Lead "Growth" Manager')).toBe(
      'lead_id.eq.lead-1,role_title.eq."Lead \\"Growth\\" Manager"'
    );
  });

  it("escapes both a comma and a double quote in the same role_title", () => {
    expect(leadIdOrRoleTitleFilter("lead-1", 'Manager, "Growth" Lead')).toBe(
      'lead_id.eq.lead-1,role_title.eq."Manager, \\"Growth\\" Lead"'
    );
  });
});

describe("fitmentLeadIdOrRoleTitleFilter", () => {
  it("quotes a plain role title", () => {
    expect(fitmentLeadIdOrRoleTitleFilter("lead-1", "Senior Product Manager")).toBe(
      'id.eq.lead-1,role_title.eq."Senior Product Manager"'
    );
  });

  it("does not let a comma in role_title split into an extra clause", () => {
    expect(fitmentLeadIdOrRoleTitleFilter("lead-1", "Manager, Growth")).toBe(
      'id.eq.lead-1,role_title.eq."Manager, Growth"'
    );
  });

  it("escapes a double quote in role_title", () => {
    expect(fitmentLeadIdOrRoleTitleFilter("lead-1", 'Lead "Growth" Manager')).toBe(
      'id.eq.lead-1,role_title.eq."Lead \\"Growth\\" Manager"'
    );
  });

  it("escapes both a comma and a double quote in the same role_title", () => {
    expect(fitmentLeadIdOrRoleTitleFilter("lead-1", 'Manager, "Growth" Lead')).toBe(
      'id.eq.lead-1,role_title.eq."Manager, \\"Growth\\" Lead"'
    );
  });
});
