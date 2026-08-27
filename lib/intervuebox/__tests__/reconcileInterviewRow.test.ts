import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabase mock, built chainable enough for what reconcileInterviewRow()
// actually does:
//   READY / APPEARED / other:  .from("fitment_interviews").update({...}).eq("id", ...)   (awaited)
//   TERMINATED:                 .from(...).update({...}).eq("id",...).eq("status","invited").select("id")
//   notifications:              .from("hub_notifications").insert({...})
let flippedRows: Array<{ id: string }> = [{ id: "r1" }];
const select = vi.fn(() => Promise.resolve({ data: flippedRows }));
const eqStatus = vi.fn(() => ({ select }));
const eqId = vi.fn(() => {
  // Both awaitable (READY/APPEARED) and chainable (TERMINATED double-eq).
  const chain = Promise.resolve({ error: null }) as unknown as Record<string, unknown>;
  chain.eq = eqStatus;
  return chain;
});
const update = vi.fn(() => ({ eq: eqId }));
const notifInsert = vi.fn().mockResolvedValue({ error: null });
const from = vi.fn((table: string) => {
  if (table === "hub_notifications") return { insert: notifInsert };
  return { update };
});
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from }) }));

const getInterviewReport = vi.fn();
const getInterviewCandidateStatus = vi.fn();
vi.mock("../interviewReports", () => ({
  getInterviewReport: (...a: unknown[]) => getInterviewReport(...a),
  getInterviewCandidateStatus: (...a: unknown[]) => getInterviewCandidateStatus(...a),
}));

import { reconcileInterviewRow } from "../reconcileInterviewRow";

const ROW = { id: "r1", user_id: "u1", role_title: "PM", ib_agent_id: "IV-1", ib_candidate_id: "C-1", status: "invited" };

describe("reconcileInterviewRow", () => {
  beforeEach(() => {
    update.mockClear();
    eqId.mockClear();
    eqStatus.mockClear();
    select.mockClear();
    notifInsert.mockClear();
    flippedRows = [{ id: "r1" }];
    getInterviewReport.mockReset();
    getInterviewCandidateStatus.mockReset();
  });

  it("READY -> writes report_raw + status ready + a notification, returns 'ready'", async () => {
    getInterviewReport.mockResolvedValue({ status: "READY", overallScore: 80, answers: [], skillReport: {} });
    expect(await reconcileInterviewRow(ROW)).toBe("ready");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "ready" }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ report_raw: expect.objectContaining({ overallScore: 80 }) }));
    expect(notifInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u1", category: "interview" }));
  });

  it("READY but row already ready -> no duplicate notification", async () => {
    getInterviewReport.mockResolvedValue({ status: "READY", overallScore: 80, answers: [], skillReport: {} });
    expect(await reconcileInterviewRow({ ...ROW, status: "ready" })).toBe("ready");
    expect(notifInsert).not.toHaveBeenCalled();
  });

  it("not ready + TERMINATED -> flips status terminated, notifies, returns 'terminated'", async () => {
    getInterviewReport.mockResolvedValue({ status: "NOT_READY" });
    getInterviewCandidateStatus.mockResolvedValue("TERMINATED");
    expect(await reconcileInterviewRow(ROW)).toBe("terminated");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "terminated", ib_interview_status: "TERMINATED" }));
    expect(notifInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u1", category: "interview" }));
  });

  it("not ready + TERMINATED but lost the flip race -> no notification", async () => {
    getInterviewReport.mockResolvedValue({ status: "NOT_READY" });
    getInterviewCandidateStatus.mockResolvedValue("TERMINATED");
    flippedRows = [];
    expect(await reconcileInterviewRow(ROW)).toBe("terminated");
    expect(notifInsert).not.toHaveBeenCalled();
  });

  it("not ready + APPEARED -> caches ib_interview_status, returns 'appeared'", async () => {
    getInterviewReport.mockResolvedValue({ status: "NOT_READY" });
    getInterviewCandidateStatus.mockResolvedValue("APPEARED");
    expect(await reconcileInterviewRow(ROW)).toBe("appeared");
    expect(update).toHaveBeenCalledWith({ ib_interview_status: "APPEARED" });
  });

  it("not ready + null candidate status -> no write, returns 'invited'", async () => {
    getInterviewReport.mockResolvedValue({ status: "NOT_READY" });
    getInterviewCandidateStatus.mockResolvedValue(null);
    expect(await reconcileInterviewRow(ROW)).toBe("invited");
    expect(update).not.toHaveBeenCalled();
  });

  it("vendor throws -> returns the row's current mapped status, never throws", async () => {
    getInterviewReport.mockRejectedValue(new Error("vendor 500"));
    expect(await reconcileInterviewRow(ROW)).toBe("invited");
    expect(await reconcileInterviewRow({ ...ROW, status: "terminated" })).toBe("terminated");
  });
});
