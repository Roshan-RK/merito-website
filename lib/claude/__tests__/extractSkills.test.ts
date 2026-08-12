import { describe, it, expect, vi, beforeEach } from "vitest";

const parseMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { parse: parseMock };
  },
}));
vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({
  zodOutputFormat: vi.fn(() => ({ type: "json_schema" })),
}));

describe("extractSkillsWithLLM", () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it("returns skills from parsed_output, capped at max", async () => {
    parseMock.mockResolvedValue({
      parsed_output: { recruiterNotes: "notes", skills: ["Python", "SQL", "AWS", "Docker"] },
    });
    const { extractSkillsWithLLM } = await import("../extractSkills");

    const result = await extractSkillsWithLLM("Some JD text", 2);

    expect(result).toEqual(["Python", "SQL"]);
  });

  it("returns an empty array when parsed_output is missing", async () => {
    parseMock.mockResolvedValue({ parsed_output: null });
    const { extractSkillsWithLLM } = await import("../extractSkills");

    const result = await extractSkillsWithLLM("Some JD text", 5);

    expect(result).toEqual([]);
  });

  it("propagates errors so callers can fall back to keyword matching", async () => {
    parseMock.mockRejectedValue(new Error("timeout"));
    const { extractSkillsWithLLM } = await import("../extractSkills");

    await expect(extractSkillsWithLLM("Some JD text", 5)).rejects.toThrow("timeout");
  });

  it("uses the Haiku model with an 8s timeout and a 600-token output ceiling", async () => {
    parseMock.mockResolvedValue({ parsed_output: { recruiterNotes: "", skills: [] } });
    const { extractSkillsWithLLM } = await import("../extractSkills");

    await extractSkillsWithLLM("Some JD text", 5);

    expect(parseMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5", max_tokens: 600 }),
      expect.objectContaining({ timeout: 8000 })
    );
  });

  it("instructs the model to output inferred skills as clean keywords, not paraphrased sentences", async () => {
    parseMock.mockResolvedValue({ parsed_output: { skills: [] } });
    const { extractSkillsWithLLM } = await import("../extractSkills");

    await extractSkillsWithLLM("Some JD text", 5);

    const prompt = parseMock.mock.calls[0][0].messages[0].content;
    expect(prompt).toMatch(/short, standard keyword/i);
  });

  it("truncates resume text sent into the prompt to 6000 chars", async () => {
    parseMock.mockResolvedValue({ parsed_output: { skills: [] } });
    const { extractSkillsWithLLM } = await import("../extractSkills");
    const longResume = "x".repeat(6000) + "TAILMARKER";

    await extractSkillsWithLLM("Some JD text", 5, longResume);

    const prompt = parseMock.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("x".repeat(6000));
    expect(prompt).not.toContain("TAILMARKER");
  });

  it("truncates JD text sent into the prompt to 10000 chars", async () => {
    parseMock.mockResolvedValue({ parsed_output: { skills: [] } });
    const { extractSkillsWithLLM } = await import("../extractSkills");
    const longJd = "y".repeat(10000) + "JDTAILMARKER";

    await extractSkillsWithLLM(longJd, 5);

    const prompt = parseMock.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("y".repeat(10000));
    expect(prompt).not.toContain("JDTAILMARKER");
  });

  it("includes the resume text in the prompt so picks are grounded in it", async () => {
    parseMock.mockResolvedValue({ parsed_output: { skills: [] } });
    const { extractSkillsWithLLM } = await import("../extractSkills");

    await extractSkillsWithLLM("Some JD text", 5, "Built AWS partnerships. Sales background.");

    const prompt = parseMock.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("Built AWS partnerships. Sales background.");
    expect(prompt).toContain("Candidate's resume:");
  });

  it("omits the resume section from the prompt when no resume text is given", async () => {
    parseMock.mockResolvedValue({ parsed_output: { skills: [] } });
    const { extractSkillsWithLLM } = await import("../extractSkills");

    await extractSkillsWithLLM("Some JD text", 5);

    const prompt = parseMock.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain("Candidate's resume:");
  });
});

describe("extractJobDetailsWithLLM", () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it("returns the LLM's title and skills together", async () => {
    parseMock.mockResolvedValue({
      parsed_output: { title: "Strategic Alliance Manager", skills: ["Partner Management", "GTM Strategy"] },
    });
    const { extractJobDetailsWithLLM } = await import("../extractSkills");

    const result = await extractJobDetailsWithLLM("Some JD text", 5, undefined, "Fallback Title");

    expect(result).toEqual({ title: "Strategic Alliance Manager", skills: ["Partner Management", "GTM Strategy"] });
  });

  it("falls back to the given fallback title when the LLM omits one", async () => {
    parseMock.mockResolvedValue({ parsed_output: { title: "", skills: ["Sales"] } });
    const { extractJobDetailsWithLLM } = await import("../extractSkills");

    const result = await extractJobDetailsWithLLM("Some JD text", 5, undefined, "Fallback Title");

    expect(result.title).toBe("Fallback Title");
  });

  it("falls back to the given fallback title when parsed_output is missing", async () => {
    parseMock.mockResolvedValue({ parsed_output: null });
    const { extractJobDetailsWithLLM } = await import("../extractSkills");

    const result = await extractJobDetailsWithLLM("Some JD text", 5, undefined, "Fallback Title");

    expect(result).toEqual({ title: "Fallback Title", skills: [] });
  });

  it("includes the fallback title in the prompt so the model can echo it back", async () => {
    parseMock.mockResolvedValue({ parsed_output: { title: "X", skills: [] } });
    const { extractJobDetailsWithLLM } = await import("../extractSkills");

    await extractJobDetailsWithLLM("Some JD text", 5, undefined, "Senior Product Manager");

    const prompt = parseMock.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("Senior Product Manager");
  });

  it("uses the Haiku model with the same 8s timeout and 600-token output ceiling", async () => {
    parseMock.mockResolvedValue({ parsed_output: { title: "X", skills: [] } });
    const { extractJobDetailsWithLLM } = await import("../extractSkills");

    await extractJobDetailsWithLLM("Some JD text", 5, undefined, "X");

    expect(parseMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5", max_tokens: 600 }),
      expect.objectContaining({ timeout: 8000 })
    );
  });
});
