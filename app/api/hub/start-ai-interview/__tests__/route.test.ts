import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: sessionFromMock,
  }),
}));

const existingMaybeSingleMock = vi.fn();
const existingEq3Mock = vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingleMock });
const existingEq2Mock = vi.fn().mockReturnValue({ eq: existingEq3Mock });
const existingEq1Mock = vi.fn().mockReturnValue({ eq: existingEq2Mock });
const existingSelectMock = vi.fn().mockReturnValue({ eq: existingEq1Mock });

const leadMaybeSingleMock = vi.fn();
const leadLimitMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEq2Mock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadEq1Mock = vi.fn().mockReturnValue({ eq: leadEq2Mock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEq1Mock });

const sessionFromMock = vi.fn((table: string) => {
  if (table === "fitment_interviews") return { select: existingSelectMock };
  if (table === "fitment_leads") return { select: leadSelectMock };
  throw new Error(`Unexpected table ${table}`);
});

const insertMock = vi.fn().mockResolvedValue({ error: null });
const adminReselectMaybeSingleMock = vi.fn();
const adminReselectEq3Mock = vi.fn().mockReturnValue({ maybeSingle: adminReselectMaybeSingleMock });
const priorAttemptMaybeSingleMock = vi.fn();
const priorAttemptLimitMock = vi.fn().mockReturnValue({ maybeSingle: priorAttemptMaybeSingleMock });
const priorAttemptOrderMock = vi.fn().mockReturnValue({ limit: priorAttemptLimitMock });
const adminReselectEq2Mock = vi.fn().mockReturnValue({ eq: adminReselectEq3Mock, order: priorAttemptOrderMock });
const adminReselectEq1Mock = vi.fn().mockReturnValue({ eq: adminReselectEq2Mock });
const adminReselectSelectMock = vi.fn().mockReturnValue({ eq: adminReselectEq1Mock });

const creditMaybeSingleMock = vi.fn();
const creditLimitMock = vi.fn().mockReturnValue({ maybeSingle: creditMaybeSingleMock });
const creditOrderMock = vi.fn().mockReturnValue({ limit: creditLimitMock });
const creditIsMock = vi.fn().mockReturnValue({ order: creditOrderMock });
const creditEq3Mock = vi.fn().mockReturnValue({ is: creditIsMock });
const creditEq2Mock = vi.fn().mockReturnValue({ eq: creditEq3Mock });
const creditEq1Mock = vi.fn().mockReturnValue({ eq: creditEq2Mock });
const creditSelectMock = vi.fn().mockReturnValue({ eq: creditEq1Mock });

const consumeUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const consumeUpdateMock = vi.fn().mockReturnValue({ eq: consumeUpdateEqMock });

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: (table: string) => {
      if (table === "razorpay_transactions") return { select: creditSelectMock, update: consumeUpdateMock };
      return { insert: insertMock, select: adminReselectSelectMock };
    },
  }),
}));

const recordPipelineFailureMock = vi.fn();
vi.mock("@/lib/pipelineFailures", () => ({ recordPipelineFailure: recordPipelineFailureMock }));

const getApplicantMock = vi.fn();
vi.mock("@/lib/intervuebox/applicants", () => ({ getApplicant: getApplicantMock }));
const createInterviewAgentMock = vi.fn();
vi.mock("@/lib/intervuebox/agents", () => ({ createInterviewAgent: createInterviewAgentMock }));
const sendInterviewInvitationMock = vi.fn();
vi.mock("@/lib/intervuebox/invitations", () => ({ sendInterviewInvitation: sendInterviewInvitationMock }));

async function importRoute() {
  return await import("../route");
}

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/hub/start-ai-interview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/hub/start-ai-interview", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    existingMaybeSingleMock.mockReset();
    leadMaybeSingleMock.mockReset();
    insertMock.mockClear();
    insertMock.mockResolvedValue({ error: null });
    adminReselectMaybeSingleMock.mockReset();
    priorAttemptMaybeSingleMock.mockReset();
    priorAttemptMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    getApplicantMock.mockReset();
    createInterviewAgentMock.mockReset();
    sendInterviewInvitationMock.mockReset();
    creditMaybeSingleMock.mockReset();
    creditMaybeSingleMock.mockResolvedValue({ data: { order_id: "order_credit_1" }, error: null });
    consumeUpdateEqMock.mockClear();
    consumeUpdateEqMock.mockResolvedValue({ error: null });
    recordPipelineFailureMock.mockReset();
    recordPipelineFailureMock.mockResolvedValue(undefined);
    delete process.env.RAZORPAY_BYPASS;
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when roleTitle is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({}));
    expect(response.status).toBe(400);
  });

  it("returns the existing status idempotently without re-inviting when an invited attempt is still pending", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: { status: "invited" }, error: null });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "invited" });
    expect(sendInterviewInvitationMock).not.toHaveBeenCalled();
  });

  it("starts a new attempt (bypassed) even when the latest attempt for this role is already ready", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "mid" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "invited" });
    expect(sendInterviewInvitationMock).toHaveBeenCalled();
  });

  it("blocks with a clear message and never charges when a prior interview row already exists for this role (IntervueBox ties one interview to one job permanently, and the old candidateId isn't valid on a new job either)", async () => {
    process.env.RAZORPAY_BYPASS = "false";
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    priorAttemptMaybeSingleMock.mockResolvedValue({ data: { id: "row-prior" }, error: null });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/already completed an AI interview/i);
    expect(creditMaybeSingleMock).not.toHaveBeenCalled();
    expect(getApplicantMock).not.toHaveBeenCalled();
    expect(createInterviewAgentMock).not.toHaveBeenCalled();
    expect(sendInterviewInvitationMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    delete process.env.RAZORPAY_BYPASS;
  });

  it("proceeds on a first-time attempt (no prior interview row for this role), using the lead's job as-is", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    priorAttemptMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "mid" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(200);
    expect(createInterviewAgentMock).toHaveBeenCalledWith("JOB_123", "Senior Product Manager", "mid");
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ ib_job_id: "JOB_123" }));
  });

  it("returns 400 when no fitment_leads row exists for this role", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(400);
  });

  it("creates the interview agent, sends the invite, and saves an invited row", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "senior" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "invited" });
    expect(createInterviewAgentMock).toHaveBeenCalledWith("JOB_123", "Senior Product Manager", "senior");
    expect(sendInterviewInvitationMock).toHaveBeenCalledWith("INT_123", ["USR_123"]);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        role_title: "Senior Product Manager",
        ib_job_id: "JOB_123",
        ib_agent_id: "INT_123",
        ib_candidate_id: "USR_123",
        status: "invited",
      })
    );
  });

  it("stores the magic link and its expiry on the inserted row", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "mid" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({
      invited: 1,
      failed: 0,
      magicLink: "https://portal/auth/magic?token=abc",
      magicLinkExpiresAt: "2026-08-20T10:00:00.000Z",
    });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(200);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        magic_link: "https://portal/auth/magic?token=abc",
        magic_link_expires_at: "2026-08-20T10:00:00.000Z",
      })
    );
  });

  it("returns 500 if the IntervueBox chain fails, and records it as interview_invite_failed (not interview_invite_after_payment, since no invite was ever confirmed sent)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "mid" },
      error: null,
    });
    getApplicantMock.mockRejectedValue(new Error("boom"));

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(500);
    expect(recordPipelineFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "interview_invite_failed",
        userId: "user-1",
        detail: expect.objectContaining({ stage: "getApplicant", error: "boom" }),
      })
    );
  });

  it("returns 500 if the invitation was sent but not actually invited, and records it as interview_invite_failed", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "mid" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 0, failed: 1 });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(500);
    expect(insertMock).not.toHaveBeenCalled();
    expect(recordPipelineFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "interview_invite_failed",
        userId: "user-1",
        detail: expect.objectContaining({ stage: "sendInterviewInvitation", ibAgentId: "INT_123", candidateId: "USR_123", invited: 0 }),
      })
    );
  });

  it("un-consumes the payment credit when the IntervueBox chain fails, so the candidate's next attempt is free", async () => {
    process.env.RAZORPAY_BYPASS = "false";
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    creditMaybeSingleMock.mockResolvedValue({ data: { order_id: "order_credit_1" }, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "mid" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockRejectedValue(new Error("vendor 500"));

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(500);
    // First call consumes the credit (existing behavior); second call here un-consumes it on failure.
    expect(consumeUpdateMock).toHaveBeenNthCalledWith(2, { consumed_at: null });
    expect(consumeUpdateEqMock).toHaveBeenNthCalledWith(2, "order_id", "order_credit_1");
    expect(recordPipelineFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "interview_invite_failed", orderId: "order_credit_1" })
    );
    delete process.env.RAZORPAY_BYPASS;
  });

  it("returns 500 with the insert error still surfaced when the insert fails for a non-conflict reason", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "mid" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });
    insertMock.mockResolvedValue({ error: { code: "42501", message: "permission denied" } });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(500);
    expect(adminReselectMaybeSingleMock).not.toHaveBeenCalled();
    expect(recordPipelineFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "interview_invite_after_payment", userId: "user-1" })
    );
  });

  it("rejects with 402 when not bypassed and there is no unconsumed successful interview transaction", async () => {
    process.env.RAZORPAY_BYPASS = "false";
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    creditMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(402);
    expect(sendInterviewInvitationMock).not.toHaveBeenCalled();
    delete process.env.RAZORPAY_BYPASS;
  });

  it("consumes the oldest unconsumed interview credit and proceeds when not bypassed", async () => {
    process.env.RAZORPAY_BYPASS = "false";
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    creditMaybeSingleMock.mockResolvedValue({ data: { order_id: "order_credit_1" }, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "senior" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(200);
    expect(consumeUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ consumed_at: expect.any(String) }));
    expect(consumeUpdateEqMock).toHaveBeenCalledWith("order_id", "order_credit_1");
    delete process.env.RAZORPAY_BYPASS;
  });

  it("treats a 23505 unique-index conflict on insert as an idempotent success and returns invited (the partial index only ever conflicts on an invited row)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123", candidate_level: "mid" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });
    insertMock.mockResolvedValue({
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    adminReselectMaybeSingleMock.mockResolvedValue({ data: { status: "invited" }, error: null });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "invited" });
    expect(adminReselectSelectMock).toHaveBeenCalled();
  });
});
