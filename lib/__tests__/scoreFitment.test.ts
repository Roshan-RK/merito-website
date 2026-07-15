import { describe, it, expect, vi, beforeEach } from "vitest";

const parseMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { parse: parseMock };
    },
  };
});

describe("scoreFitment", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("returns the parsed score and verdict from Claude", async () => {
    parseMock.mockResolvedValue({
      parsed_output: { score: 7.8, verdict: "Good fit for this role." },
    });
    const { scoreFitment } = await import("../scoreFitment");
    const result = await scoreFitment("Senior Product Manager JD text", "CV text");
    expect(result).toEqual({ score: 7.8, verdict: "Good fit for this role." });
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("throws if Claude returns no parsed output", async () => {
    parseMock.mockResolvedValue({ parsed_output: null });
    const { scoreFitment } = await import("../scoreFitment");
    await expect(scoreFitment("jd", "cv")).rejects.toThrow();
  });
});
