import { describe, it, expect } from "vitest";
import { messageForElapsedMs, GENERATING_MESSAGE_INTERVAL_MS } from "../interviewGeneratingMessages";

describe("messageForElapsedMs", () => {
  it("returns the first message at elapsed 0", () => {
    expect(messageForElapsedMs(0)).toBe("Wrapping up your interview…");
  });

  it("returns the first message for the whole first interval", () => {
    expect(messageForElapsedMs(GENERATING_MESSAGE_INTERVAL_MS - 1)).toBe("Wrapping up your interview…");
  });

  it("advances to the second message once the first interval elapses", () => {
    expect(messageForElapsedMs(GENERATING_MESSAGE_INTERVAL_MS)).toBe("Scoring your responses…");
  });

  it("advances to the third message in the third interval", () => {
    expect(messageForElapsedMs(GENERATING_MESSAGE_INTERVAL_MS * 2)).toBe("Building your skill-wise breakdown…");
  });

  it("advances to the fourth message in the fourth interval", () => {
    expect(messageForElapsedMs(GENERATING_MESSAGE_INTERVAL_MS * 3)).toBe("Preparing your coaching plan…");
  });

  it("wraps back to the first message after a full cycle", () => {
    expect(messageForElapsedMs(GENERATING_MESSAGE_INTERVAL_MS * 4)).toBe("Wrapping up your interview…");
  });
});
