import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/intervuebox/jobs", () => ({ createJob: vi.fn().mockResolvedValue({ ibJobId: "JOB_1" }) }));
vi.mock("@/lib/intervuebox/resumes", () => ({ uploadResume: vi.fn().mockResolvedValue({ ibResumeId: "RES_1" }) }));
vi.mock("@/lib/intervuebox/applicants", () => ({ addApplicant: vi.fn().mockResolvedValue({ ibAppliedJobId: "APJ_1" }) }));
vi.mock("@/lib/intervuebox/reports", () => ({ getResumeMatchReport: vi.fn() }));
vi.mock("@/lib/syntheticResume", () => ({ buildSyntheticResumePdf: vi.fn().mockResolvedValue(Buffer.from("pdf")) }));
vi.mock("@/lib/recruiterIdentity", () => ({ isRecruiterEmailVerified: vi.fn() }));

const insertSelectSingleMock = vi.fn().mockResolvedValue({ data: { id: "prospect-1" }, error: null });
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const countThenMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table !== "recruiter_sourced_prospects") throw new Error(`unexpected table ${table}`);
  return {
    select: () => ({
      eq: () => ({
        gte: () => ({ then: countThenMock }),
      }),
    }),
    insert: () => ({ select: () => ({ single: insertSelectSingleMock }) }),
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

describe("scoreProspect", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { isRecruiterEmailVerified } = await import("@/lib/recruiterIdentity");
    vi.mocked(isRecruiterEmailVerified).mockReset().mockResolvedValue(true);
    countThenMock.mockReset().mockImplementation((resolve: (v: { count: number }) => void) => resolve({ count: 0 }));
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockReset();
  });
  afterEach(() => vi.resetModules());

  it("returns verification_required when the recruiter email isn't verified", async () => {
    const { isRecruiterEmailVerified } = await import("@/lib/recruiterIdentity");
    vi.mocked(isRecruiterEmailVerified).mockResolvedValue(false);
    const { scoreProspect } = await import("../recruiterSourcedProspects");
    const result = await scoreProspect(INPUT);
    expect(result.status).toBe("verification_required");
  });

  it("returns cap_exceeded at 10 prospects this month", async () => {
    countThenMock.mockImplementation((resolve: (v: { count: number }) => void) => resolve({ count: 10 }));
    const { scoreProspect } = await import("../recruiterSourcedProspects");
    const result = await scoreProspect(INPUT);
    expect(result.status).toBe("cap_exceeded");
  });

  it("runs the IntervueBox chain and returns a ready result under the cap", async () => {
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockResolvedValue({
      status: "READY", overallScore: 82, rank: null, categories: [], summary: "Good fit", strongPoints: [], weakPoints: [],
    });
    const { scoreProspect } = await import("../recruiterSourcedProspects");
    const result = await scoreProspect(INPUT);

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.prospectId).toBe("prospect-1");
      expect(result.report.overallScore).toBe(82);
    }
    const { createJob } = await import("@/lib/intervuebox/jobs");
    expect(vi.mocked(createJob)).toHaveBeenCalledWith(expect.objectContaining({ candidateLevel: "mid" }));
  });
});
