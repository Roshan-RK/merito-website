import { describe, it, expect, vi, afterEach } from "vitest";
import { createRateLimiter } from "../rateLimit";

describe("createRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows calls under the max", () => {
    const check = createRateLimiter({ max: 2, windowMs: 1000 });
    expect(check("a@example.com")).toBe(true);
    expect(check("a@example.com")).toBe(true);
  });

  it("blocks calls over the max within the window", () => {
    const check = createRateLimiter({ max: 2, windowMs: 1000 });
    check("a@example.com");
    check("a@example.com");
    expect(check("a@example.com")).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const check = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(check("a@example.com")).toBe(true);
    expect(check("b@example.com")).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const check = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(check("a@example.com")).toBe(true);
    expect(check("a@example.com")).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(check("a@example.com")).toBe(true);
  });
});
