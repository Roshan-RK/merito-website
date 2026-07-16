import { describe, it, expect, vi, beforeEach } from "vitest";

const parseMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { parse: parseMock };
    },
  };
});

describe("generateFitmentReport", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("returns the parsed requirements and action plan from Claude", async () => {
    parseMock.mockResolvedValue({
      parsed_output: {
        requirements: [
          {
            requirement: "5+ years React experience",
            matchLevel: "strong",
            evidence: "Led React frontend rewrite for 3 years at Acme Corp",
            note: "Directly demonstrates senior-level React experience.",
          },
          {
            requirement: "Team leadership experience",
            matchLevel: "missing",
            evidence: "Not found in CV",
            note: "No mention of managing or leading a team.",
          },
        ],
        actionPlan: [
          {
            priority: 1,
            action: "Add a leadership example to your CV",
            why: "This is the JD's top unmet requirement.",
          },
          {
            priority: 2,
            action: "Quantify your React project's impact",
            why: "Numbers make strong matches more convincing.",
          },
        ],
      },
    });
    const { generateFitmentReport } = await import("../generateFitmentReport");
    const result = await generateFitmentReport("Senior PM JD text", "CV text", 7.8);

    expect(result.requirements).toHaveLength(2);
    expect(result.requirements[0]).toEqual({
      requirement: "5+ years React experience",
      matchLevel: "strong",
      evidence: "Led React frontend rewrite for 3 years at Acme Corp",
      note: "Directly demonstrates senior-level React experience.",
    });
    expect(result.actionPlan).toHaveLength(2);
    expect(result.actionPlan[0].priority).toBe(1);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("throws if Claude returns no parsed output", async () => {
    parseMock.mockResolvedValue({ parsed_output: null });
    const { generateFitmentReport } = await import("../generateFitmentReport");
    await expect(generateFitmentReport("jd", "cv", 7.8)).rejects.toThrow();
  });
});
