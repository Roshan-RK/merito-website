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

  it("returns the parsed verdict summary, categories, and action plan from Claude", async () => {
    parseMock.mockResolvedValue({
      parsed_output: {
        verdictSummary: "This candidate is a strong technical fit with a gap in leadership experience.",
        categories: [
          {
            category: "Technical Skills",
            matchedCount: 1,
            totalCount: 1,
            requirements: [
              {
                requirement: "5+ years React experience",
                matchLevel: "strong",
                isMustHave: true,
                evidence: "Led React frontend rewrite for 3 years at Acme Corp",
                note: "Directly demonstrates senior-level React experience.",
                interviewNote: "Lead with this project when asked about your React background.",
              },
            ],
          },
          {
            category: "Experience",
            matchedCount: 0,
            totalCount: 1,
            requirements: [
              {
                requirement: "Team leadership experience",
                matchLevel: "missing",
                isMustHave: false,
                evidence: "Not found in CV",
                note: "No mention of managing or leading a team.",
                interviewNote: "If asked, mention any informal mentoring or project ownership you've taken on.",
              },
            ],
          },
        ],
        actionPlan: [
          {
            priority: 1,
            action: "Add a leadership example to your CV",
            why: "This is the JD's top unmet requirement.",
            effort: "moderate",
          },
        ],
      },
    });
    const { generateFitmentReport } = await import("../generateFitmentReport");
    const result = await generateFitmentReport("Senior PM JD text", "CV text", 7.8);

    expect(result.verdictSummary).toContain("strong technical fit");
    expect(result.categories).toHaveLength(2);
    expect(result.categories[0].matchedCount).toBe(1);
    expect(result.categories[0].requirements[0].isMustHave).toBe(true);
    expect(result.actionPlan[0].effort).toBe("moderate");
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("throws if Claude returns no parsed output", async () => {
    parseMock.mockResolvedValue({ parsed_output: null });
    const { generateFitmentReport } = await import("../generateFitmentReport");
    await expect(generateFitmentReport("jd", "cv", 7.8)).rejects.toThrow();
  });
});
