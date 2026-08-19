import { describe, it, expect, vi, beforeEach } from "vitest";

const getInterviewReportMock = vi.fn();
const getInterviewCandidateStatusMock = vi.fn();
vi.mock("../interviewReports", () => ({
  getInterviewReport: getInterviewReportMock,
  getInterviewCandidateStatus: getInterviewCandidateStatusMock,
}));

const selectEqMock = vi.fn();
const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock });
const readyUpdateEq2Mock = vi.fn().mockResolvedValue({ error: null });
const readyUpdateEq1Mock = vi.fn().mockReturnValue({ eq: readyUpdateEq2Mock });
const ibStatusUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const terminatedSelectMock = vi.fn().mockResolvedValue({ data: [{ id: "row-1" }] });
const terminatedEq2Mock = vi.fn().mockReturnValue({ select: terminatedSelectMock });
const terminatedEq1Mock = vi.fn().mockReturnValue({ eq: terminatedEq2Mock });
const insertMock = vi.fn().mockResolvedValue({ error: null });

// update() is called with different shapes depending on the branch -- route
// each call to the right chain based on what's in the payload, since a
// single generic mock can't otherwise tell "flip to ready" apart from
// "write ib_interview_status" apart from "conditional flip to terminated".
const updateMock = vi.fn((payload: Record<string, unknown>) => {
  if (payload.status === "ready") return { eq: readyUpdateEq1Mock };
  if (payload.status === "terminated") return { eq: terminatedEq1Mock };
  return { eq: ibStatusUpdateEqMock };
});
const fromMock = vi.fn((table: string) => {
  if (table === "hub_notifications") return { insert: insertMock };
  return { select: selectMock, update: updateMock };
});
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importSweep() {
  return await import("../sweepPendingInterviews");
}

describe("sweepPendingInterviews", () => {
  beforeEach(() => {
    getInterviewReportMock.mockReset();
    getInterviewCandidateStatusMock.mockReset();
    selectEqMock.mockReset();
    updateMock.mockClear();
    readyUpdateEq1Mock.mockClear();
    readyUpdateEq2Mock.mockClear();
    ibStatusUpdateEqMock.mockClear();
    terminatedEq1Mock.mockClear();
    terminatedEq2Mock.mockClear();
    terminatedSelectMock.mockClear();
    terminatedSelectMock.mockResolvedValue({ data: [{ id: "row-1" }] });
    insertMock.mockClear();
  });

  it("flips a READY row to ready and never calls getInterviewCandidateStatus for it", async () => {
    selectEqMock.mockResolvedValue({
      data: [{ id: "row-1", user_id: "user-1", role_title: "Backend Engineer", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" }],
      error: null,
    });
    getInterviewReportMock.mockResolvedValue({
      status: "READY",
      overallScore: 8,
      skillMetrics: {},
      overallSummary: "s",
      strengths: null,
      areasOfImprovement: null,
      shareableReportLink: "https://x",
      approxDurationMinutes: 4,
      flagForSuspiciousActivity: false,
      integrityCheck: null,
      videoReport: null,
      feedbackToInterviewer: null,
      roadmap: null,
      criteriaEvaluationTable: [],
      interviewTitle: null,
      skillReport: {},
      overallSkillScore: null,
      answers: [],
      knowledgeAnswers: [],
    });

    const { sweepPendingInterviews } = await importSweep();
    const result = await sweepPendingInterviews();

    expect(result).toEqual({ ready: 1, appeared: 0, terminated: 0, errors: 0 });
    expect(getInterviewCandidateStatusMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "ready" }));
  });

  it("writes ib_interview_status without flipping status when the candidate has APPEARED", async () => {
    selectEqMock.mockResolvedValue({
      data: [{ id: "row-1", user_id: "user-1", role_title: "Backend Engineer", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" }],
      error: null,
    });
    getInterviewReportMock.mockResolvedValue({ status: "NOT_READY" });
    getInterviewCandidateStatusMock.mockResolvedValue("APPEARED");

    const { sweepPendingInterviews } = await importSweep();
    const result = await sweepPendingInterviews();

    expect(result).toEqual({ ready: 0, appeared: 1, terminated: 0, errors: 0 });
    expect(updateMock).toHaveBeenCalledWith({ ib_interview_status: "APPEARED" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("flips status to terminated and inserts a notification when the candidate has TERMINATED", async () => {
    selectEqMock.mockResolvedValue({
      data: [{ id: "row-1", user_id: "user-1", role_title: "Backend Engineer", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" }],
      error: null,
    });
    getInterviewReportMock.mockResolvedValue({ status: "NOT_READY" });
    getInterviewCandidateStatusMock.mockResolvedValue("TERMINATED");

    const { sweepPendingInterviews } = await importSweep();
    const result = await sweepPendingInterviews();

    expect(result).toEqual({ ready: 0, appeared: 0, terminated: 1, errors: 0 });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "terminated", ib_interview_status: "TERMINATED" })
    );
    expect(terminatedEq1Mock).toHaveBeenCalledWith("id", "row-1");
    expect(terminatedEq2Mock).toHaveBeenCalledWith("status", "invited");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", category: "interview", created_by: "system" })
    );
  });

  it("does not insert a notification when the conditional terminated update loses the race", async () => {
    selectEqMock.mockResolvedValue({
      data: [{ id: "row-1", user_id: "user-1", role_title: "Backend Engineer", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" }],
      error: null,
    });
    getInterviewReportMock.mockResolvedValue({ status: "NOT_READY" });
    getInterviewCandidateStatusMock.mockResolvedValue("TERMINATED");
    terminatedSelectMock.mockResolvedValue({ data: [] });

    const { sweepPendingInterviews } = await importSweep();
    const result = await sweepPendingInterviews();

    expect(result).toEqual({ ready: 0, appeared: 0, terminated: 0, errors: 0 });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("counts a genuine DB error on the terminated-flip update as an error, not a lost race", async () => {
    selectEqMock.mockResolvedValue({
      data: [{ id: "row-1", user_id: "user-1", role_title: "Backend Engineer", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" }],
      error: null,
    });
    getInterviewReportMock.mockResolvedValue({ status: "NOT_READY" });
    getInterviewCandidateStatusMock.mockResolvedValue("TERMINATED");
    terminatedSelectMock.mockResolvedValue({ data: null, error: { message: "connection reset" } });

    const { sweepPendingInterviews } = await importSweep();
    const result = await sweepPendingInterviews();

    expect(result).toEqual({ ready: 0, appeared: 0, terminated: 0, errors: 1 });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("counts a per-row failure as an error and keeps processing the rest of the batch", async () => {
    selectEqMock.mockResolvedValue({
      data: [
        { id: "row-1", user_id: "user-1", role_title: "Role A", ib_agent_id: "INT_1", ib_candidate_id: "USR_1" },
        { id: "row-2", user_id: "user-2", role_title: "Role B", ib_agent_id: "INT_2", ib_candidate_id: "USR_2" },
      ],
      error: null,
    });
    getInterviewReportMock.mockImplementation(async (interviewId: string) => {
      if (interviewId === "INT_1") throw new Error("vendor 500");
      return { status: "NOT_READY" };
    });
    getInterviewCandidateStatusMock.mockResolvedValue(null);

    const { sweepPendingInterviews } = await importSweep();
    const result = await sweepPendingInterviews();

    expect(result).toEqual({ ready: 0, appeared: 0, terminated: 0, errors: 1 });
  });

  it("returns zero counts when there are no invited rows", async () => {
    selectEqMock.mockResolvedValue({ data: [], error: null });
    const { sweepPendingInterviews } = await importSweep();
    const result = await sweepPendingInterviews();
    expect(result).toEqual({ ready: 0, appeared: 0, terminated: 0, errors: 0 });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
