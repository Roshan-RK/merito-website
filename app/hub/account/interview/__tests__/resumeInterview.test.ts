import { describe, it, expect, vi, afterEach } from "vitest";

// resumeInterview is the shared fetch/parse guts behind both the "terminated"
// and "appeared" Resume buttons. Kept out of the "use client" components so
// this repo's "node" vitest env can unit-test it directly -- same shape as
// pollInterviewStatus.test.ts (mock fetch via vi.stubGlobal).
import { resumeInterview } from "../resumeInterview";

const FALLBACK = "Couldn't resume this interview. Please try again.";

describe("resumeInterview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns { ok: true, url } from a 2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://vendor/resume?t=1" }) })
    );
    const result = await resumeInterview("lead-1");
    expect(result).toEqual({ ok: true, url: "https://vendor/resume?t=1" });
  });

  it("POSTs the lead id as JSON to the resume route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "u" }) });
    vi.stubGlobal("fetch", fetchMock);
    await resumeInterview("lead-42");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/hub/interview/resume",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: "lead-42" }),
      })
    );
  });

  it("returns the vendor error text when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Cannot resume an interview in status EVALUATED" }),
      })
    );
    const result = await resumeInterview("lead-1");
    expect(result).toEqual({ ok: false, error: "Cannot resume an interview in status EVALUATED" });
  });

  it("falls back to generic copy when a failed response carries no error body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    const result = await resumeInterview("lead-1");
    expect(result).toEqual({ ok: false, error: FALLBACK });
  });

  it("falls back to generic copy when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await resumeInterview("lead-1");
    expect(result).toEqual({ ok: false, error: FALLBACK });
  });
});
