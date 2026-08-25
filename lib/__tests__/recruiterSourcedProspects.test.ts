import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const resolveJobDetailsMock = vi.fn();
vi.mock("@/lib/intervuebox/jobs", () => ({
  createJob: vi.fn().mockResolvedValue({ ibJobId: "JOB_1" }),
  resolveJobDetails: resolveJobDetailsMock,
}));
vi.mock("@/lib/intervuebox/resumes", () => ({ uploadResume: vi.fn().mockResolvedValue({ ibResumeId: "RES_1" }) }));
vi.mock("@/lib/intervuebox/applicants", () => ({
  addApplicant: vi.fn(),
  listApplicantsForJob: vi.fn(),
  isDuplicateApplicantError: (err: unknown) =>
    err instanceof Error && /already applied|already been created for this (resume|job)/i.test(err.message),
}));
vi.mock("@/lib/intervuebox/reports", () => ({ getResumeMatchReport: vi.fn() }));
vi.mock("@/lib/syntheticResume", () => ({
  buildSyntheticResumePdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
  buildResumeText: vi.fn().mockReturnValue("Jane Doe\nEngineer"),
}));
vi.mock("@/lib/recruiterIdentity", () => ({ isRecruiterEmailVerified: vi.fn() }));
const getMonthlyCheckCountMock = vi.fn();
vi.mock("@/lib/recruiterChecks", () => ({
  MONTHLY_CHECK_CAP: 10,
  getMonthlyCheckCount: getMonthlyCheckCountMock,
}));
vi.mock("@/lib/intervuebox/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/intervuebox/client")>("@/lib/intervuebox/client");
  return { IntervueBoxError: actual.IntervueBoxError };
});

const insertSelectSingleMock = vi.fn().mockResolvedValue({ data: { id: "prospect-1" }, error: null });
const insertMock = vi.fn(() => ({ select: () => ({ single: insertSelectSingleMock }) }));
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const maybeSingleMock = vi.fn().mockResolvedValue({ data: null });
const fromMock = vi.fn((table: string) => {
  if (table !== "recruiter_sourced_prospects") throw new Error(`unexpected table ${table}`);
  const selectChain = {
    eq: () => selectChain,
    maybeSingle: maybeSingleMock,
  };
  return {
    select: () => selectChain,
    insert: insertMock,
    update: () => ({ eq: updateEqMock }),
  };
});
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from: fromMock }) }));

const INPUT = {
  recruiterEmail: "recruiter@example.com",
  linkedinUrl: "https://www.linkedin.com/in/jane-doe",
  candidateFields: { name: "Jane Doe", headline: "Engineer", experience: [], education: [], skills: [] },
  candidateLevel: "mid" as const,
  jdText: "We need a backend engineer.",
};

const READY_REPORT = {
  status: "READY" as const,
  overallScore: 82,
  rank: null,
  categories: [],
  summary: "Good fit",
  strongPoints: [],
  weakPoints: [],
};

async function importModule() {
  return await import("../recruiterSourcedProspects");
}

async function stillParsingError() {
  const { IntervueBoxError } = await import("@/lib/intervuebox/client");
  return new IntervueBoxError({ code: "unknown_error", status: 400, message: "Resume is still being parsed and has no linked candidate yet." });
}

async function duplicateApplicantError() {
  const { IntervueBoxError } = await import("@/lib/intervuebox/client");
  return new IntervueBoxError({ code: "unknown_error", status: 400, message: "Candidate already applied for this job" });
}

beforeEach(async () => {
  vi.resetModules();
  insertSelectSingleMock.mockClear().mockResolvedValue({ data: { id: "prospect-1" }, error: null });
  insertMock.mockClear();
  updateEqMock.mockClear().mockResolvedValue({ error: null });
  getMonthlyCheckCountMock.mockReset().mockResolvedValue(0);
  maybeSingleMock.mockReset().mockResolvedValue({ data: null });
  const { isRecruiterEmailVerified } = await import("@/lib/recruiterIdentity");
  vi.mocked(isRecruiterEmailVerified).mockReset().mockResolvedValue(true);
  const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
  vi.mocked(getResumeMatchReport).mockReset();
  const { addApplicant, listApplicantsForJob } = await import("@/lib/intervuebox/applicants");
  vi.mocked(addApplicant).mockReset();
  vi.mocked(listApplicantsForJob).mockReset();
  const { createJob } = await import("@/lib/intervuebox/jobs");
  vi.mocked(createJob).mockClear();
  resolveJobDetailsMock.mockReset().mockResolvedValue({ skills: [], title: "First line of the JD" });
});
afterEach(() => vi.resetModules());

describe("startScoringProspect", () => {
  it("returns verification_required when the recruiter email isn't verified", async () => {
    const { isRecruiterEmailVerified } = await import("@/lib/recruiterIdentity");
    vi.mocked(isRecruiterEmailVerified).mockResolvedValue(false);
    const { startScoringProspect } = await importModule();
    const result = await startScoringProspect(INPUT);
    expect(result.status).toBe("verification_required");
  });

  it("returns cap_exceeded at 10 prospects this month", async () => {
    getMonthlyCheckCountMock.mockResolvedValue(10);
    const { startScoringProspect } = await importModule();
    const result = await startScoringProspect(INPUT);
    expect(result.status).toBe("cap_exceeded");
  });

  it("returns the cached ready result for a repeat visit without re-running IntervueBox or spending the cap", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: "prospect-1", resume_match_raw: READY_REPORT } });
    const { startScoringProspect } = await importModule();
    const result = await startScoringProspect(INPUT);

    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.report.overallScore).toBe(82);
    const { createJob } = await import("@/lib/intervuebox/jobs");
    expect(vi.mocked(createJob)).not.toHaveBeenCalled();
  });

  it("passes the scraped candidate fields as resumeText to createJob for skill grounding", async () => {
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockResolvedValue({ ibAppliedJobId: "APJ_1" });
    const { startScoringProspect } = await importModule();
    await startScoringProspect(INPUT);

    const { createJob } = await import("@/lib/intervuebox/jobs");
    expect(vi.mocked(createJob)).toHaveBeenCalledWith(
      expect.objectContaining({ resumeText: "Jane Doe\nEngineer" })
    );
  });

  it("uses the LLM-derived title from resolveJobDetails instead of the first-line heuristic", async () => {
    resolveJobDetailsMock.mockResolvedValue({ skills: ["Node.js"], title: "Backend Engineer" });
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockResolvedValue({ ibAppliedJobId: "APJ_1" });
    const { startScoringProspect } = await importModule();
    await startScoringProspect(INPUT);

    const { createJob } = await import("@/lib/intervuebox/jobs");
    expect(vi.mocked(createJob)).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Backend Engineer", skills: ["Node.js"] })
    );
  });

  it("returns pending with the applicant already linked when addApplicant succeeds immediately", async () => {
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockResolvedValue({ ibAppliedJobId: "APJ_1" });
    const { startScoringProspect } = await importModule();
    const result = await startScoringProspect(INPUT);

    expect(result.status).toBe("pending");
    if (result.status === "pending") expect(result.prospectId).toBe("prospect-1");
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", ib_applied_job_id: "APJ_1" }));
  });

  it("returns pending with no applicant linked yet when the resume is still parsing", async () => {
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockRejectedValue(await stillParsingError());
    const { startScoringProspect } = await importModule();
    const result = await startScoringProspect(INPUT);

    expect(result.status).toBe("pending");
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", ib_applied_job_id: null }));
  });

  it("marks the row failed and returns failed on an unexpected addApplicant error", async () => {
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockRejectedValue(new Error("boom"));
    const { startScoringProspect } = await importModule();
    const result = await startScoringProspect(INPUT);

    expect(result.status).toBe("failed");
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("recovers the applicantId and returns pending when IntervueBox reports a duplicate applicant", async () => {
    const { addApplicant, listApplicantsForJob } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockRejectedValue(await duplicateApplicantError());
    vi.mocked(listApplicantsForJob).mockResolvedValue({
      total: 1,
      page: 1,
      limit: 10,
      applicants: [{ applicantId: "APJ_RECOVERED", candidateId: "CAND_1", candidateName: "Jane", candidateEmail: "x@example.com", resumeMatchScore: null }],
    });
    const { startScoringProspect } = await importModule();
    const result = await startScoringProspect(INPUT);

    expect(result.status).toBe("pending");
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", ib_applied_job_id: "APJ_RECOVERED" }));
  });
});

describe("getProspectScoreStatus", () => {
  it("returns failed when the prospect row doesn't exist", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    const { getProspectScoreStatus } = await importModule();
    const result = await getProspectScoreStatus("missing-id", "recruiter@example.com");
    expect(result.status).toBe("failed");
  });

  it("returns failed when the prospect belongs to a different recruiter", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { status: "ready", resume_match_raw: READY_REPORT, jd_text: INPUT.jdText, ib_applied_job_id: "APJ_1", recruiter_email: "owner@example.com" },
    });
    const { getProspectScoreStatus } = await importModule();
    const result = await getProspectScoreStatus("prospect-1", "someone-else@example.com");
    expect(result.status).toBe("failed");
  });

  it("returns the stored ready result without calling IntervueBox again", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { status: "ready", resume_match_raw: READY_REPORT, jd_text: INPUT.jdText, ib_applied_job_id: "APJ_1", recruiter_email: "recruiter@example.com" },
    });
    const { getProspectScoreStatus } = await importModule();
    const result = await getProspectScoreStatus("prospect-1", "recruiter@example.com");

    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.report.overallScore).toBe(82);
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    expect(vi.mocked(getResumeMatchReport)).not.toHaveBeenCalled();
  });

  it("returns failed when the row is marked failed", async () => {
    maybeSingleMock.mockResolvedValue({ data: { status: "failed", jd_text: INPUT.jdText, recruiter_email: "recruiter@example.com" } });
    const { getProspectScoreStatus } = await importModule();
    const result = await getProspectScoreStatus("prospect-1", "recruiter@example.com");
    expect(result.status).toBe("failed");
  });

  it("retries addApplicant when no applicant is linked yet, staying pending if still parsing", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { status: "pending", ib_job_id: "JOB_1", ib_resume_id: "RES_1", ib_applied_job_id: null, candidate_name: "Jane", jd_text: INPUT.jdText, recruiter_email: "recruiter@example.com" },
    });
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockRejectedValue(await stillParsingError());
    const { getProspectScoreStatus } = await importModule();
    const result = await getProspectScoreStatus("prospect-1", "recruiter@example.com");

    expect(result.status).toBe("pending");
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("links the applicant, then reports pending while the match report is still generating", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { status: "pending", ib_job_id: "JOB_1", ib_resume_id: "RES_1", ib_applied_job_id: null, candidate_name: "Jane", jd_text: INPUT.jdText, recruiter_email: "recruiter@example.com" },
    });
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockResolvedValue({ ibAppliedJobId: "APJ_1" });
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockResolvedValue({ status: "PENDING" });
    const { getProspectScoreStatus } = await importModule();
    const result = await getProspectScoreStatus("prospect-1", "recruiter@example.com");

    expect(result.status).toBe("pending");
    expect(updateEqMock).toHaveBeenCalledWith("id", "prospect-1");
  });

  it("returns ready and persists the report once IntervueBox finishes", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { status: "pending", ib_job_id: "JOB_1", ib_resume_id: "RES_1", ib_applied_job_id: "APJ_1", candidate_name: "Jane", jd_text: INPUT.jdText, recruiter_email: "recruiter@example.com" },
    });
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockResolvedValue(READY_REPORT);
    const { getProspectScoreStatus } = await importModule();
    const result = await getProspectScoreStatus("prospect-1", "recruiter@example.com");

    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.report.overallScore).toBe(82);
    expect(updateEqMock).toHaveBeenCalledWith("id", "prospect-1");
  });
});
