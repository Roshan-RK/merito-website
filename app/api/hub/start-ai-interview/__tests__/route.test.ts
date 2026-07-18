import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: sessionFromMock,
  }),
}));

const existingMaybeSingleMock = vi.fn();
const existingEq2Mock = vi.fn().mockReturnValue({ maybeSingle: existingMaybeSingleMock });
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
const adminReselectEq2Mock = vi.fn().mockReturnValue({ maybeSingle: adminReselectMaybeSingleMock });
const adminReselectEq1Mock = vi.fn().mockReturnValue({ eq: adminReselectEq2Mock });
const adminReselectSelectMock = vi.fn().mockReturnValue({ eq: adminReselectEq1Mock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: () => ({ insert: insertMock, select: adminReselectSelectMock }),
  }),
}));

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
    getApplicantMock.mockReset();
    createInterviewAgentMock.mockReset();
    sendInterviewInvitationMock.mockReset();
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

  it("returns the existing status idempotently without re-inviting when a row already exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: { status: "ready" }, error: null });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(sendInterviewInvitationMock).not.toHaveBeenCalled();
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
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "invited" });
    expect(createInterviewAgentMock).toHaveBeenCalledWith("JOB_123");
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

  it("returns 500 if the IntervueBox chain fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123" },
      error: null,
    });
    getApplicantMock.mockRejectedValue(new Error("boom"));

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(500);
  });

  it("returns 500 if the invitation was sent but not actually invited", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 0, failed: 1 });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));
    expect(response.status).toBe(500);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 500 with the insert error still surfaced when the insert fails for a non-conflict reason", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });
    insertMock.mockResolvedValue({ error: { code: "42501", message: "permission denied" } });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(500);
    expect(adminReselectSelectMock).not.toHaveBeenCalled();
  });

  it("treats a 23505 primary-key conflict on insert as an idempotent success and returns the existing row's status", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    existingMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    leadMaybeSingleMock.mockResolvedValue({
      data: { ib_job_id: "JOB_123", ib_applied_job_id: "APJ_123" },
      error: null,
    });
    getApplicantMock.mockResolvedValue({ candidateId: "USR_123" });
    createInterviewAgentMock.mockResolvedValue({ ibAgentId: "INT_123" });
    sendInterviewInvitationMock.mockResolvedValue({ invited: 1, failed: 0 });
    insertMock.mockResolvedValue({
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    adminReselectMaybeSingleMock.mockResolvedValue({ data: { status: "ready" }, error: null });

    const { POST } = await importRoute();
    const response = await POST(buildRequest({ roleTitle: "Senior Product Manager" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(adminReselectSelectMock).toHaveBeenCalled();
  });
});
