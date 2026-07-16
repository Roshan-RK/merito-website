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

  it("returns the parsed strengths, gaps, and CV fixes from Claude", async () => {
    parseMock.mockResolvedValue({
      parsed_output: {
        strengths: ["Strong product sense", "5+ years B2B SaaS experience"],
        gaps: ["No direct people-management experience"],
        cvFixes: ["Quantify the revenue impact of your last two launches"],
      },
    });
    const { generateFitmentReport } = await import("../generateFitmentReport");
    const result = await generateFitmentReport("Senior PM JD text", "CV text", 7.8);
    expect(result).toEqual({
      strengths: ["Strong product sense", "5+ years B2B SaaS experience"],
      gaps: ["No direct people-management experience"],
      cvFixes: ["Quantify the revenue impact of your last two launches"],
    });
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("throws if Claude returns no parsed output", async () => {
    parseMock.mockResolvedValue({ parsed_output: null });
    const { generateFitmentReport } = await import("../generateFitmentReport");
    await expect(generateFitmentReport("jd", "cv", 7.8)).rejects.toThrow();
  });
});
