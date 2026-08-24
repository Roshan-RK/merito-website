import { describe, it, expect, vi } from "vitest";
import { groupSectionsByLead, nextSections, saveSections } from "../RecruiterpPreviewRoleConfig";

describe("groupSectionsByLead", () => {
  it("builds a lead_id -> sections[] map from recruiter_preview_sections rows", () => {
    const rows = [
      { lead_id: "lead-1", sections: ["fitment"] },
      { lead_id: "lead-2", sections: ["fitment", "personality"] },
    ];
    expect(groupSectionsByLead(rows)).toEqual({
      "lead-1": ["fitment"],
      "lead-2": ["fitment", "personality"],
    });
  });

  it("returns an empty map for no rows", () => {
    expect(groupSectionsByLead([])).toEqual({});
  });
});

describe("nextSections", () => {
  it("adds the section when checked", () => {
    expect(nextSections(["fitment"], "personality", true)).toEqual(["fitment", "personality"]);
  });

  it("removes the section when unchecked", () => {
    expect(nextSections(["fitment", "personality"], "fitment", false)).toEqual(["personality"]);
  });

  it("starts from unchecked-by-default (empty array)", () => {
    expect(nextSections([], "interview", true)).toEqual(["interview"]);
  });
});

describe("saveSections", () => {
  function buildMockSupabase(opts: { upsertError?: unknown; insertError?: unknown } = {}) {
    const upsert = vi.fn(() => Promise.resolve({ error: opts.upsertError ?? null }));
    const insert = vi.fn(() => Promise.resolve({ error: opts.insertError ?? null }));
    const from = vi.fn((table: string) => {
      if (table === "recruiter_preview_sections") return { upsert };
      if (table === "recruiter_preview_audit") return { insert };
      throw new Error(`unexpected table: ${table}`);
    });
    return { from, upsert, insert } as any;
  }

  it("upserts the section row and logs an audit event on success", async () => {
    const supabase = buildMockSupabase();

    const result = await saveSections(supabase, "user-1", "lead-1", ["fitment"]);

    expect(result.error).toBeNull();
    expect(supabase.from).toHaveBeenCalledWith("recruiter_preview_sections");
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", lead_id: "lead-1", sections: ["fitment"] })
    );
    expect(supabase.from).toHaveBeenCalledWith("recruiter_preview_audit");
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", lead_id: "lead-1", action: "sections_updated" })
    );
  });

  it("returns the error and skips the audit log when the upsert fails", async () => {
    const supabase = buildMockSupabase({ upsertError: new Error("db down") });

    const result = await saveSections(supabase, "user-1", "lead-1", ["fitment"]);

    expect(result.error).toBeTruthy();
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("does not fail the save when the audit log insert throws (fire-and-forget)", async () => {
    const supabase = buildMockSupabase({ insertError: new Error("audit down") });

    const result = await saveSections(supabase, "user-1", "lead-1", ["fitment"]);

    expect(result.error).toBeNull();
  });
});
