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

  it("is 'stuck' when stuck_at is set, taking priority over 'invited'", () => {
    expect(
      resolveInterviewViewState({ status: "invited", report_raw: null, ib_interview_status: null, stuck_at: "2026-08-19T10:00:00.000Z" })
    ).toBe("stuck");
  });

  it("is 'stuck' when stuck_at is set, taking priority over 'terminated'", () => {
    expect(
      resolveInterviewViewState({ status: "terminated", report_raw: null, ib_interview_status: "TERMINATED", stuck_at: "2026-08-19T10:00:00.000Z" })
    ).toBe("stuck");
  });

  it("is not 'stuck' when stuck_at is null", () => {
    expect(
      resolveInterviewViewState({ status: "invited", report_raw: null, ib_interview_status: null, stuck_at: null })
    ).toBe("invited");
  });

  it("is 'ready' even when stuck_at is set, if the report actually arrived", () => {
    expect(
      resolveInterviewViewState({ status: "ready", report_raw: { overallScore: 80 }, ib_interview_status: null, stuck_at: "2026-08-19T10:00:00.000Z" })
    ).toBe("ready");
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

  it("is 'processing' while the vendor is scoring a finished interview (EVALUATING)", () => {
    expect(resolveInterviewViewState({ status: "invited", report_raw: null, ib_interview_status: "EVALUATING" })).toBe("processing");
  });

  it("is 'processing' once the interview is EVALUATED but the report hasn't been pulled yet", () => {
    expect(resolveInterviewViewState({ status: "invited", report_raw: null, ib_interview_status: "EVALUATED" })).toBe("processing");
  });

  it("is 'ready', not 'processing', once the EVALUATED report actually lands", () => {
    expect(resolveInterviewViewState({ status: "ready", report_raw: { overallScore: 36 }, ib_interview_status: "EVALUATED" })).toBe("ready");
  });

  it("is 'terminated', not 'processing', when a terminated row also shows EVALUATED", () => {
    expect(resolveInterviewViewState({ status: "terminated", report_raw: null, ib_interview_status: "EVALUATED" })).toBe("terminated");
  });

  it("stays 'appeared' (resume card) while the candidate is still mid-interview", () => {
    expect(resolveInterviewViewState({ status: "invited", report_raw: null, ib_interview_status: "APPEARED" })).toBe("appeared");
  });
});
