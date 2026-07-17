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
  form.set("recaptchaToken", "token-123");
  form.set("cv", new Blob(["cv bytes"], { type: "application/pdf" }), "resume.pdf");
  for (const [key, value] of Object.entries(overrides)) {
    form.set(key, value);
  }
  return form;
}

describe("POST /api/hub/fitment-check", () => {
  beforeEach(() => {
    insertMock.mockClear();
    insertSelectMock.mockClear();
    insertSelectSingleMock.mockClear();
    insertSelectSingleMock.mockResolvedValue({ data: { id: "lead-1" }, error: null });
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
        ib_job_id: "JOB_123",
        ib_resume_id: "RES_123",
        ib_applied_job_id: "APJ_123",
        resume_match_status: "READY",
      })
    );
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

  it("returns 500 if any IntervueBox call in the chain fails", async () => {
    const { addApplicant } = await import("@/lib/intervuebox/applicants");
    vi.mocked(addApplicant).mockRejectedValueOnce(new Error("boom"));
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
