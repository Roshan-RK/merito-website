import { describe, it, expect, vi, beforeEach } from "vitest";

const logAdminActionMock = vi.fn();
vi.mock("@/lib/adminAuditLog", () => ({ logAdminAction: logAdminActionMock }));

const fromMock = vi.fn();
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from: fromMock }) }));

describe("recordPipelineFailure", () => {
  it("inserts a row and never throws even if the insert fails", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: { message: "db error" } });
    fromMock.mockReset();
    fromMock.mockReturnValue({ insert: insertMock });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { recordPipelineFailure } = await import("../pipelineFailures");

    await expect(
      recordPipelineFailure({ kind: "orphaned_ib_job", userId: null, leadId: null, orderId: null, detail: { a: 1 } })
    ).resolves.toBeUndefined();

    expect(insertMock).toHaveBeenCalledWith({
      kind: "orphaned_ib_job",
      user_id: null,
      lead_id: null,
      order_id: null,
      detail: { a: 1 },
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe("retryInterviewFromFailure", () => {
  beforeEach(() => {
    fromMock.mockReset();
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("inserts the recovered fitment_interviews row and resolves the failure", async () => {
    const failureSelectMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "failure-1",
        kind: "interview_invite_after_payment",
        user_id: "user-1",
        lead_id: "lead-1",
        detail: { roleTitle: "PM", ibJobId: "job-1", ibAgentId: "agent-1", ibCandidateId: "cand-1" },
        resolved_at: null,
      },
      error: null,
    });
    const insertInterviewMock = vi.fn().mockResolvedValue({ error: null });
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

    fromMock.mockImplementation((table: string) => {
      if (table === "pipeline_failures") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: failureSelectMaybeSingle }) }),
          update: updateMock,
        };
      }
      if (table === "fitment_interviews") return { insert: insertInterviewMock };
      throw new Error(`unexpected table ${table}`);
    });

    const { retryInterviewFromFailure } = await import("../pipelineFailures");

    await retryInterviewFromFailure("failure-1", "roshan@merito.in");

    expect(insertInterviewMock).toHaveBeenCalledWith({
      user_id: "user-1",
      role_title: "PM",
      lead_id: "lead-1",
      ib_job_id: "job-1",
      ib_agent_id: "agent-1",
      ib_candidate_id: "cand-1",
      status: "invited",
    });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ resolved_by: "roshan@merito.in" }));
    expect(logAdminActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pipeline_failure.retry_interview", targetId: "user-1" })
    );
  });

  it("throws when the failure is already resolved", async () => {
    const failureSelectMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: "failure-1", kind: "interview_invite_after_payment", user_id: "user-1", detail: {}, resolved_at: "2026-08-01T00:00:00Z" },
      error: null,
    });
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: failureSelectMaybeSingle }) }) });

    const { retryInterviewFromFailure } = await import("../pipelineFailures");

    await expect(retryInterviewFromFailure("failure-1", "roshan@merito.in")).rejects.toThrow(
      "Pipeline failure not found or not eligible for retry."
    );
  });
});

describe("discardPipelineFailure", () => {
  beforeEach(() => {
    fromMock.mockReset();
    logAdminActionMock.mockReset();
    logAdminActionMock.mockResolvedValue(undefined);
  });

  it("marks the failure resolved and logs the action", async () => {
    const failureSelectMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: "failure-1", kind: "orphaned_ib_job", user_id: null, resolved_at: null },
      error: null,
    });
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: failureSelectMaybeSingle }) }), update: updateMock });

    const { discardPipelineFailure } = await import("../pipelineFailures");

    await discardPipelineFailure("failure-1", "roshan@merito.in");

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ resolved_by: "roshan@merito.in" }));
    expect(logAdminActionMock).toHaveBeenCalledWith(expect.objectContaining({ action: "pipeline_failure.discard" }));
  });
});
