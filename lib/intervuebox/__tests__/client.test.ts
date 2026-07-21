import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("intervueBoxFetch", () => {
  beforeEach(() => {
    vi.stubEnv("INTERVUEBOX_API_KEY", "sk_test_abc");
    vi.stubEnv("INTERVUEBOX_BASE_URL", "https://api.intervuebox.ai/api/v1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends a bearer token and returns the parsed JSON body on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, jobId: "JOB_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { intervueBoxFetch } = await import("../client");
    const result = await intervueBoxFetch<{ success: boolean; jobId: string }>("/public/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "PM" }),
    });

    expect(result).toEqual({ success: true, jobId: "JOB_123" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.intervuebox.ai/api/v1/public/jobs",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      })
    );
    const sentHeaders = fetchMock.mock.calls[0][1].headers as Headers;
    expect(sentHeaders.get("Authorization")).toBe("Bearer sk_test_abc");
  });

  it("throws a typed IntervueBoxError with the unwrapped error body on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: "invalid_request", message: "title is required", status: 400, details: { field: "title" } },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { intervueBoxFetch, IntervueBoxError } = await import("../client");
    await expect(intervueBoxFetch("/public/jobs", { method: "POST" })).rejects.toThrow(IntervueBoxError);

    try {
      await intervueBoxFetch("/public/jobs", { method: "POST" });
    } catch (err) {
      expect(err).toBeInstanceOf(IntervueBoxError);
      const ibErr = err as InstanceType<typeof IntervueBoxError>;
      expect(ibErr.code).toBe("invalid_request");
      expect(ibErr.status).toBe(400);
      expect(ibErr.details).toEqual({ field: "title" });
    }
  });

  it("extracts the real message from a flat { message, error, statusCode } error body", async () => {
    // IntervueBox's live API doesn't always follow the documented
    // { error: { code, message, status } } envelope — confirmed against a
    // real request, some endpoints return this flat shape instead.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        response: { title: "Resume still parsing", message: "Resume is still being parsed and has no linked candidate yet." },
        status: 400,
        message: "Resume is still being parsed and has no linked candidate yet.",
        name: "HttpException",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { intervueBoxFetch, IntervueBoxError } = await import("../client");
    try {
      await intervueBoxFetch("/public/jobs/JOB_1/applicants", { method: "POST" });
      throw new Error("expected intervueBoxFetch to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(IntervueBoxError);
      const ibErr = err as InstanceType<typeof IntervueBoxError>;
      expect(ibErr.message).toBe("Resume is still being parsed and has no linked candidate yet.");
      expect(ibErr.status).toBe(400);
    }
  });

  it("throws a plain Error if INTERVUEBOX_API_KEY is missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("INTERVUEBOX_BASE_URL", "https://api.intervuebox.ai/api/v1");
    const { intervueBoxFetch } = await import("../client");
    await expect(intervueBoxFetch("/public/jobs")).rejects.toThrow(/INTERVUEBOX_API_KEY/);
  });
});
