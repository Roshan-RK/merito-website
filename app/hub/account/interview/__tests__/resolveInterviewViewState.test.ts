import { describe, it, expect } from "vitest";
import { resolveInterviewViewState } from "../resolveInterviewViewState";

describe("resolveInterviewViewState", () => {
  it("is 'locked' when there's no interview row at all", () => {
    expect(resolveInterviewViewState(null)).toBe("locked");
    expect(resolveInterviewViewState(undefined)).toBe("locked");
  });

  it("is 'in_progress' when a row exists but is still 'invited'", () => {
    expect(resolveInterviewViewState({ status: "invited", report_raw: null })).toBe("in_progress");
  });

  it("is 'in_progress' when status is 'ready' but report_raw hasn't landed yet", () => {
    expect(resolveInterviewViewState({ status: "ready", report_raw: null })).toBe("in_progress");
  });

  it("is 'ready' once status is 'ready' and report_raw is populated", () => {
    expect(resolveInterviewViewState({ status: "ready", report_raw: { overallScore: 80 } })).toBe("ready");
  });
});
