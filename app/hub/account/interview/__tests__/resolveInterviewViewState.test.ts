import { describe, it, expect } from "vitest";
import { resolveInterviewViewState } from "../resolveInterviewViewState";

describe("resolveInterviewViewState", () => {
  it("is 'locked' when there's no interview row at all", () => {
    expect(resolveInterviewViewState(null)).toBe("locked");
    expect(resolveInterviewViewState(undefined)).toBe("locked");
  });

  it("is 'invited' when a row exists, is still 'invited', and hasn't appeared", () => {
    expect(resolveInterviewViewState({ status: "invited", report_raw: null, ib_interview_status: null })).toBe("invited");
  });

  it("is 'invited' when ib_interview_status is INVITED explicitly", () => {
    expect(resolveInterviewViewState({ status: "invited", report_raw: null, ib_interview_status: "INVITED" })).toBe("invited");
  });

  it("is 'appeared' when the candidate has started but isn't evaluated yet", () => {
    expect(resolveInterviewViewState({ status: "invited", report_raw: null, ib_interview_status: "APPEARED" })).toBe("appeared");
  });

  it("is 'terminated' when status is 'terminated', regardless of ib_interview_status", () => {
    expect(resolveInterviewViewState({ status: "terminated", report_raw: null, ib_interview_status: "TERMINATED" })).toBe("terminated");
  });

  it("is 'invited' when status is 'ready' but report_raw hasn't landed yet", () => {
    expect(resolveInterviewViewState({ status: "ready", report_raw: null, ib_interview_status: null })).toBe("invited");
  });

  it("is 'ready' once status is 'ready' and report_raw is populated", () => {
    expect(resolveInterviewViewState({ status: "ready", report_raw: { overallScore: 80 }, ib_interview_status: null })).toBe("ready");
  });
});
