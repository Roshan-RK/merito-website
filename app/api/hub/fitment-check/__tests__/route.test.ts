import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/recaptcha", () => ({
  verifyRecaptchaToken: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/parseCvFile", () => ({
  parseCvFile: vi.fn().mockResolvedValue("Extracted CV text"),
  UnsupportedCvFileError: class UnsupportedCvFileError extends Error {},
}));
vi.mock("@/lib/scoreFitment", () => ({
  scoreFitment: vi.fn().mockResolvedValue({ score: 7.8, verdict: "Good fit." }),
}));

const insertMock = vi.fn().mockResolvedValue({ error: null });
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
  form.set("email", "candidate@example.com");
  form.set("role", "Senior Product Manager");
  form.set("jdText", "We need a PM who can ship.");
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
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 with the score for a valid submission", async () => {
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ score: 7.8, verdict: "Good fit." });
    expect(insertMock).toHaveBeenCalledTimes(1);
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

  it("rejects a submission with an unsupported file type", async () => {
    const { parseCvFile, UnsupportedCvFileError } = await import("@/lib/parseCvFile");
    vi.mocked(parseCvFile).mockRejectedValueOnce(new UnsupportedCvFileError());
    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/fitment-check", {
      method: "POST",
      body: buildForm(),
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
});
