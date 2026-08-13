import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn();
const fromMock = vi.fn(() => ({ upsert: upsertMock }));
const getSupabaseServerClientMock = vi.fn(() => ({ from: fromMock }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("logNewSkillsForReview", () => {
  beforeEach(() => {
    upsertMock.mockReset().mockResolvedValue({ error: null });
    fromMock.mockClear();
    getSupabaseServerClientMock.mockClear();
  });

  it("upserts only skills not already in the known keyword list", async () => {
    const { logNewSkillsForReview } = await import("../learnedSkills");

    logNewSkillsForReview(["Meta Ads", "SQL", "Shopify"], ["SQL", "AWS"], "Marketing Lead");
    await flush();

    expect(fromMock).toHaveBeenCalledWith("learned_skill_keywords");
    expect(upsertMock).toHaveBeenCalledWith(
      [
        { skill: "Meta Ads", sample_job_title: "Marketing Lead" },
        { skill: "Shopify", sample_job_title: "Marketing Lead" },
      ],
      { onConflict: "skill", ignoreDuplicates: true }
    );
  });

  it("matches known keywords case-insensitively", async () => {
    const { logNewSkillsForReview } = await import("../learnedSkills");

    logNewSkillsForReview(["sql"], ["SQL"], "Engineer");
    await flush();

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("does nothing when every skill is already known", async () => {
    const { logNewSkillsForReview } = await import("../learnedSkills");

    logNewSkillsForReview(["SQL", "AWS"], ["SQL", "AWS"], "Engineer");
    await flush();

    expect(getSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("never throws when the DB call fails", async () => {
    upsertMock.mockRejectedValue(new Error("db down"));
    const { logNewSkillsForReview } = await import("../learnedSkills");

    expect(() => logNewSkillsForReview(["Meta Ads"], ["SQL"], "Marketing Lead")).not.toThrow();
    await flush();
  });
});
