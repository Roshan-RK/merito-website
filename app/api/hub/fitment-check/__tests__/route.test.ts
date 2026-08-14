import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/recaptcha", () => ({
  verifyRecaptchaToken: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/intervuebox/jobs", () => ({
  createJob: vi.fn().mockResolvedValue({ ibJobId: "JOB_123" }),
}));
vi.mock("@/lib/intervuebox/resumes", () => ({
  uploadResume: vi.fn().mockResolvedValue({ ibResumeId: "RES_123" }),
}));
vi.mock("@/lib/intervuebox/applicants", () => ({
  addApplicant: vi.fn().mockResolvedValue({ ibAppliedJobId: "APJ_123" }),
  listApplicantsForJob: vi.fn(),
  isDuplicateApplicantError: (err: unknown) =>
    err instanceof Error && /already applied|already been created for this (resume|job)/i.test(err.message),
}));
vi.mock("@/lib/intervuebox/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/intervuebox/client")>("@/lib/intervuebox/client");
  return { IntervueBoxError: actual.IntervueBoxError };
});
const recordPipelineFailureMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/pipelineFailures", () => ({ recordPipelineFailure: recordPipelineFailureMock }));
const extractJdTextMock = vi.fn().mockResolvedValue("Sales and partnerships resume text.");
vi.mock("@/lib/jdFileText", () => ({
  extractJdText: extractJdTextMock,
}));
vi.mock("@/lib/intervuebox/reports", () => ({
  getResumeMatchReport: vi.fn().mockResolvedValue({
    status: "READY",
    overallScore: 78,
    rank: 1,
    categories: [],
    summary: "Good fit.",
    strongPoints: [],
    weakPoints: [],
  }),
  scoreOutOfTen: (overallScore: number) => Math.round(overallScore * 10) / 100,
}));

const insertSelectSingleMock = vi.fn().mockResolvedValue({ data: { id: "lead-1" }, error: null });
const insertSelectMock = vi.fn().mockReturnValue({ single: insertSelectSingleMock });
const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

async function importRoute() {
  return await import("../route");
}

function buildForm(overrides: Record<string, string | Blob> = {}) {
  const form = new FormData();
  form.set("name", "Jane Doe");
  form.set("email", "candidate@example.com");
  form.set("role", "Senior Product Manager");
  form.set("jdText", "We need a PM who can ship.");
  form.set("phone", "+919876543210");
  form.set("candidateLevel", "senior");
  form.set("recaptchaToken", "token-123");
  form.set("cv", new Blob(["cv bytes"], { type: "application/pdf" }), "resume.pdf");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

describe("POST /api/hub/fitment-check", () => {
  beforeEach(async () => {
    insertMock.mockClear();
    insertSelectMock.mockClear();
    insertSelectSingleMock.mockClear();
    insertSelectSingleMock.mockResolvedValue({ data: { id: "lead-1" }, error: null });
    extractJdTextMock.mockReset().mockResolvedValue("Sales and partnerships resume text.");
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockReset().mockResolvedValue({ ibAppliedJobId: "APJ_123" });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 ready with the score when the resume-match report resolves inline", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ready", score: 7.8, verdict: "Good fit." });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+919876543210",
        ib_job_id: "JOB_123",
        ib_resume_id: "RES_123",
        ib_applied_job_id: "APJ_123",
        resume_match_status: "READY",
      })
    );
  });

  it("passes the CV's extracted text to createJob so skill selection can be grounded in it", async () => {
    extractJdTextMock.mockResolvedValue("Strategic Alliance Manager. Built AWS partnership.");
    const { createJob } = await import("@/lib/intervuebox/jobs");
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    await POST(request);

    const callInput = vi.mocked(createJob).mock.calls.at(-1)![0];
    expect(callInput.resumeText).toBe("Strategic Alliance Manager. Built AWS partnership.");
  });

  it("still succeeds with no resumeText when the CV can't be parsed for text", async () => {
    extractJdTextMock.mockRejectedValue(new Error("Couldn't extract any text from that file."));
    const { createJob } = await import("@/lib/intervuebox/jobs");
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const callInput = vi.mocked(createJob).mock.calls.at(-1)![0];
    expect(callInput.resumeText).toBeUndefined();
  });

  it("returns 400 when candidateLevel is missing", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm({ candidateLevel: "" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when candidateLevel isn't one of entry/mid/senior", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm({ candidateLevel: "expert" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("saves candidateLevel on the inserted lead", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm({ candidateLevel: "senior" }),
    });
    await POST(request);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ candidate_level: "senior" }));
  });

  it("returns 200 pending with a leadId when the resume-match report isn't ready yet", async () => {
    const { getResumeMatchReport } = await import("@/lib/intervuebox/reports");
    vi.mocked(getResumeMatchReport).mockResolvedValueOnce({ status: "PENDING" });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "pending", leadId: "lead-1" });
  });

  it("rejects a submission with no email", async () => {
    const form = buildForm();
    form.delete("email");
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: form,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a submission with no phone number", async () => {
    const form = buildForm();
    form.delete("phone");
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: form,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a submission that fails reCAPTCHA", async () => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "test-secret");
    const { verifyRecaptchaToken } = await import("@/lib/recaptcha");
    vi.mocked(verifyRecaptchaToken).mockResolvedValueOnce(false);
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a CV file larger than 5MB", async () => {
    const bigFile = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "application/pdf" });
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm({ cv: bigFile }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/too large/i);
  });

  it("rejects requests once the per-IP rate limit is exceeded, even with different emails", async () => {
    const { POST } = await importRoute();
    const headers = { "x-forwarded-for": "203.0.113.5" };

    let lastResponse: Response | undefined;
    for (let i = 0; i < 6; i++) {
      const request = new Request("http://localhost/api/hub/fitment-check", {
        method: "POST",
        headers,
        body: buildForm({ email: `candidate${i}@example.com` }),
      });
      lastResponse = await POST(request);
    }

    expect(lastResponse?.status).toBe(429);
  });

  it("returns 502 if any IntervueBox call in the chain fails", async () => {
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockRejectedValueOnce(new Error("boom"));
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(502);
    expect(recordPipelineFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "orphaned_ib_job", detail: expect.objectContaining({ ibJobId: "JOB_123" }) })
    );
  });

  it("returns 409 with a duplicate flag if IntervueBox reports a conflict", async () => {
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    const { IntervueBoxError } = await import("@/lib/intervuebox/client");
    vi.mocked(addApplicant).mockRejectedValueOnce(
      new IntervueBoxError({ code: "conflict", message: "Applicant already exists.", status: 409 })
    );
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data.duplicate).toBe(true);
  });

  it("returns 409 with a duplicate flag if IntervueBox reports 'already applied' via a plain 400", async () => {
    // Real-world race: addApplicant errors "still being parsed", our retry
    // fires, but IntervueBox finishes linking the applicant asynchronously
    // in between — the retry then gets this 400, not a 409. Must be treated
    // as a duplicate, not a dead-end 502.
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    const { IntervueBoxError } = await import("@/lib/intervuebox/client");
    vi.mocked(addApplicant).mockRejectedValueOnce(
      new IntervueBoxError({ code: "unknown_error", message: "Candidate already applied for this job", status: 400 })
    );
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data.duplicate).toBe(true);
  });

  it("returns 409 with a duplicate flag if uploadResume reports the resume was already applied to this job", async () => {
    const { uploadResume } = await import("@/lib/intervuebox/resumes");
    const { IntervueBoxError } = await import("@/lib/intervuebox/client");
    vi.mocked(uploadResume).mockRejectedValueOnce(
      new IntervueBoxError({
        code: "unknown_error",
        message: "An applied job has already been created for this resume and job.",
        status: 400,
      })
    );
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data.duplicate).toBe(true);
  });

  it("retries addApplicant while the resume is still being parsed, then succeeds", async () => {
    vi.stubEnv("RESUME_PARSE_MAX_WAIT_MS", "200");
    vi.stubEnv("RESUME_PARSE_RETRY_INTERVAL_MS", "5");
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    const { IntervueBoxError } = await import("@/lib/intervuebox/client");
    vi.mocked(addApplicant)
      .mockRejectedValueOnce(
        new IntervueBoxError({
          code: "bad_request",
          message: "Resume is still being parsed and has no linked candidate yet.",
          status: 400,
        })
      )
      .mockResolvedValueOnce({ ibAppliedJobId: "APJ_123" });

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);

    // A plain rejection (no retry) would have 500'd immediately — 200 here
    // only happens if the retry loop caught the "still parsing" rejection
    // and successfully re-called addApplicant to get the resolved value.
    expect(response.status).toBe(200);
  });

  it("gives up and returns 500 if the resume is still parsing after the max wait", async () => {
    vi.stubEnv("RESUME_PARSE_MAX_WAIT_MS", "20");
    vi.stubEnv("RESUME_PARSE_RETRY_INTERVAL_MS", "5");
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    const { IntervueBoxError } = await import("@/lib/intervuebox/client");
    vi.mocked(addApplicant).mockRejectedValue(
      new IntervueBoxError({
        code: "bad_request",
        message: "Resume is still being parsed and has no linked candidate yet.",
        status: 400,
      })
    );

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);

    expect(response.status).toBe(502);
  });

  it("retries addApplicant while the job is inactive, then succeeds", async () => {
    vi.stubEnv("JOB_INACTIVE_MAX_WAIT_MS", "200");
    vi.stubEnv("JOB_INACTIVE_RETRY_INTERVAL_MS", "5");
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    const { IntervueBoxError } = await import("@/lib/intervuebox/client");
    vi.mocked(addApplicant)
      .mockRejectedValueOnce(
        new IntervueBoxError({
          code: "bad_request",
          message: 'Cannot apply to "Test Role" because it is currently inactive or closed.',
          status: 400,
        })
      )
      .mockResolvedValueOnce({ ibAppliedJobId: "APJ_123" });

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);

    // A plain rejection (no retry) would have 502'd immediately — 200 here
    // only happens if the retry loop caught the "inactive" rejection and
    // successfully re-called addApplicant to get the resolved value.
    expect(response.status).toBe(200);
  });

  it("gives up and returns 502 if the job is still inactive after the max wait", async () => {
    vi.stubEnv("JOB_INACTIVE_MAX_WAIT_MS", "20");
    vi.stubEnv("JOB_INACTIVE_RETRY_INTERVAL_MS", "5");
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    const { IntervueBoxError } = await import("@/lib/intervuebox/client");
    vi.mocked(addApplicant).mockRejectedValue(
      new IntervueBoxError({
        code: "bad_request",
        message: 'Cannot apply to "Test Role" because it is currently inactive or closed.',
        status: 400,
      })
    );

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);

    expect(response.status).toBe(502);
  });

  it("rejects a submission with no candidateLevel", async () => {
    const form = buildForm();
    form.delete("candidateLevel");
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: form,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a submission with an unrecognized candidateLevel", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm({ candidateLevel: "expert" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("stores candidateLevel on the fitment_leads insert", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm({ candidateLevel: "entry" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ candidate_level: "entry" })
    );
  });

  describe("jdUrl (JD link mode)", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("fetches the URL, strips HTML, and passes the extracted text as jobDescription", async () => {
      const html = "<html><head><style>.x{color:red}</style></head><body><script>track()</script><h1>Senior PM</h1><p>We need a PM who can ship &amp; own roadmaps across three product lines with a decade of B2B SaaS depth.</p></body></html>";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/html" }),
          text: () => Promise.resolve(html),
        })
      );
      const { createJob } = await import("@/lib/intervuebox/jobs");
      const { POST } = await importRoute();
      const request = new Request("http://localhost/api/hub/fitment-check", {
        method: "POST",
        body: buildForm({ jdText: "", jdUrl: "https://company.com/careers/pm" }),
      });
      const response = await POST(request);
      expect(response.status).toBe(200);
      const callInput = vi.mocked(createJob).mock.calls.at(-1)![0];
      expect(callInput.jobDescription).toContain("Senior PM");
      expect(callInput.jobDescription).toContain("We need a PM who can ship & own roadmaps");
      expect(callInput.jobDescription).not.toContain("<");
      expect(callInput.jobDescription).not.toContain("track()");
    });

    it("returns 400 without ever fetching when the URL targets a private/internal host (SSRF guard)", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { POST } = await importRoute();
      const request = new Request("http://localhost/api/hub/fitment-check", {
        method: "POST",
        body: buildForm({ jdText: "", jdUrl: "http://169.254.169.254/latest/meta-data/" }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 400 when the link can't be fetched", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 404, headers: new Headers(), text: () => Promise.resolve("") })
      );
      const { POST } = await importRoute();
      const request = new Request("http://localhost/api/hub/fitment-check", {
        method: "POST",
        body: buildForm({ jdText: "", jdUrl: "https://company.com/gone" }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toMatch(/paste the job description instead/i);
    });
  });
});
