import { describe, it, expect, vi, beforeEach } from "vitest";

const maybeSingleMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn((table: string) => {
  if (table === "recruiter_sourced_prospects") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      update: () => ({ eq: updateEqMock }),
    };
  }
  if (table === "fitment_leads") {
    return { insert: () => ({ select: () => ({ single: insertSelectSingleMock }) }) };
  }
  throw new Error(`unexpected table ${table}`);
});
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from: fromMock }) }));

async function importModule() {
  return await import("../prospectConversion");
}

const READY_PROSPECT = {
  id: "prospect-1",
  candidate_name: "Jane Doe",
  candidate_level: "mid",
  jd_text: "Backend Engineer role",
  ib_job_id: "JOB_1",
  ib_resume_id: "RES_1",
  ib_applied_job_id: "APJ_1",
  resume_match_raw: { overallScore: 82, rank: null, categories: [], summary: "Good fit", strongPoints: [], weakPoints: [] },
  converted_lead_id: null,
};

describe("convertProspectToLead", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    insertSelectSingleMock.mockReset();
    updateEqMock.mockClear();
  });

  it("returns not_found for an unknown claim token", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    const { convertProspectToLead } = await importModule();
    const result = await convertProspectToLead("bad-token", "user-1", "jane@example.com");
    expect(result.status).toBe("not_found");
  });

  it("returns already_converted without inserting again", async () => {
    maybeSingleMock.mockResolvedValue({ data: { ...READY_PROSPECT, converted_lead_id: "lead-existing" } });
    const { convertProspectToLead } = await importModule();
    const result = await convertProspectToLead("token", "user-1", "jane@example.com");
    expect(result).toEqual({ status: "already_converted", leadId: "lead-existing" });
    expect(insertSelectSingleMock).not.toHaveBeenCalled();
  });

  it("inserts a fitment_leads row reusing the IntervueBox IDs and score, then marks converted", async () => {
    maybeSingleMock.mockResolvedValue({ data: READY_PROSPECT });
    insertSelectSingleMock.mockResolvedValue({ data: { id: "lead-new" }, error: null });

    const { convertProspectToLead } = await importModule();
    const result = await convertProspectToLead("token", "user-1", "jane@example.com");

    expect(result).toEqual({ status: "converted", leadId: "lead-new" });
    expect(updateEqMock).toHaveBeenCalledWith("id", "prospect-1");
  });
});
