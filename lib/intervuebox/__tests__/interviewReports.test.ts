import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => {
  class IntervueBoxError extends Error {
    code: string;
    status: number;
    details?: unknown;
    constructor(shape: { code: string; message: string; status: number; details?: unknown }) {
      super(shape.message);
      this.name = "IntervueBoxError";
      this.code = shape.code;
      this.status = shape.status;
      this.details = shape.details;
    }
  }
  return { intervueBoxFetch: intervueBoxFetchMock, IntervueBoxError };
});

describe("getInterviewReport", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("maps a ready report into the typed shape", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      interviewSessionId: "ISE_123",
      shareableReportLink: "https://app.intervuebox.com/reports/ISE_123",
      sessionDetails: {
        overallSkillScore: 85,
        skillReport: { technical: 85, communication: 90, problemSolving: 80 },
        overallReport: "Strong candidate.",
        status: "Completed",
      },
    });
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toEqual({
      status: "READY",
      overallSkillScore: 85,
      skillReport: { technical: 85, communication: 90, problemSolving: 80 },
      overallReport: "Strong candidate.",
      shareableReportLink: "https://app.intervuebox.com/reports/ISE_123",
    });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/reports/interviews",
      expect.objectContaining({ method: "GET", headers: { "Content-Type": "application/json" } })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({ interviewId: "INT_123", candidateId: "USR_123" });
  });

  it("returns NOT_READY when IntervueBox responds 404", async () => {
    const { IntervueBoxError } = await import("../client");
    intervueBoxFetchMock.mockRejectedValue(
      new IntervueBoxError({ code: "not_found", message: "Report is not available for this candidate yet", status: 404 })
    );
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toEqual({ status: "NOT_READY" });
  });

  it("re-throws non-404 errors", async () => {
    const { IntervueBoxError } = await import("../client");
    intervueBoxFetchMock.mockRejectedValue(
      new IntervueBoxError({ code: "unauthorized", message: "bad key", status: 401 })
    );
    const { getInterviewReport } = await import("../interviewReports");

    await expect(getInterviewReport("INT_123", "USR_123")).rejects.toThrow("bad key");
  });
});
