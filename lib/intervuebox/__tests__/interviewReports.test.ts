import http from "http";
import type { AddressInfo } from "net";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

// getInterviewReport no longer goes through the mocked `intervueBoxFetch` —
// IntervueBox's `GET /public/reports/interviews` requires a JSON body on a
// GET, which Node's native `fetch` (what `intervueBoxFetch` wraps) rejects
// with `TypeError: Request with GET/HEAD method cannot have body`. A test
// that mocked `intervueBoxFetch` never exercised that failure mode — this
// file instead spins up a real local HTTP server so every case (including
// the mapping/404 cases previously covered by mocks) goes through the real
// Node `http` request path the fix now uses, proving GET+body actually works
// end-to-end and can't silently regress.

let server: http.Server;
let baseUrl: string;
let lastRequest: { method?: string; body: string } | null = null;
let respond: (req: http.IncomingMessage, res: http.ServerResponse) => void = (_req, res) => {
  res.writeHead(500);
  res.end();
};

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      lastRequest = { method: req.method, body: raw };
      respond(req, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

beforeEach(() => {
  process.env.INTERVUEBOX_API_KEY = "test-key";
  process.env.INTERVUEBOX_BASE_URL = baseUrl;
  lastRequest = null;
});

describe("getInterviewReport", () => {
  it("issues a real GET request carrying a JSON body and maps a ready report", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          shareableReportLink: "https://app.intervuebox.com/reports/ISE_123",
          sessionDetails: {
            skillReport: {},
            answers: [{ timestamp: "00:00:24" }, { timestamp: "00:03:27" }],
            flagForSuspiciousActivity: true,
            integrityCheck: "No tab changes detected.",
            videoReport: "Confident, appropriate dress code.",
            overallReport: {
              score: 8,
              metrics: { technical: 8, communication: 9, problemSolving: 8 },
              overallSummary: "Strong candidate.",
              strengths: "Clear technical explanations.",
              areasOfImprovement: "Could give more concrete examples.",
              feedbackToInterviewer: "Recommend advancing.",
              roadmap: "Short-term: practice mock interviews.",
              rank: 1,
            },
          },
        })
      );
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    // Proves the exact bug class from the critical finding cannot recur:
    // a real GET request that actually carries a non-empty body.
    expect(lastRequest?.method).toBe("GET");
    expect(lastRequest?.body).toBeTruthy();
    expect(JSON.parse(lastRequest!.body)).toEqual({ interviewId: "INT_123", candidateId: "USR_123" });

    expect(result).toEqual({
      status: "READY",
      overallScore: 8,
      skillMetrics: { technical: 8, communication: 9, problemSolving: 8 },
      overallSummary: "Strong candidate.",
      strengths: "Clear technical explanations.",
      areasOfImprovement: "Could give more concrete examples.",
      shareableReportLink: "https://app.intervuebox.com/reports/ISE_123",
      approxDurationMinutes: 4,
      flagForSuspiciousActivity: true,
      integrityCheck: "No tab changes detected.",
      videoReport: "Confident, appropriate dress code.",
      feedbackToInterviewer: "Recommend advancing.",
      roadmap: "Short-term: practice mock interviews.",
      criteriaEvaluationTable: [],
    });
  });

  it("maps criteriaEvaluationTable when the upstream report includes it", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          shareableReportLink: null,
          sessionDetails: {
            skillReport: {},
            overallReport: {
              score: 7,
              metrics: {},
              overallSummary: "Criteria-based interview.",
              criteriaEvaluationTable: [
                { skill: "Stakeholder Management", commentary: "Handled pushback well." },
              ],
            },
          },
        })
      );
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toMatchObject({
      status: "READY",
      criteriaEvaluationTable: [
        { skill: "Stakeholder Management", commentary: "Handled pushback well." },
      ],
    });
  });

  it("defaults criteriaEvaluationTable to an empty array when the upstream report omits it", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          shareableReportLink: null,
          sessionDetails: {
            skillReport: {},
            overallReport: { score: 5, metrics: {}, overallSummary: "No table." },
          },
        })
      );
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toMatchObject({ status: "READY", criteriaEvaluationTable: [] });
  });

  it("passes overallScore through as-is (real API scale is 0-100, not 0-10)", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          shareableReportLink: null,
          sessionDetails: {
            skillReport: {},
            overallReport: { score: 100, metrics: {}, overallSummary: "Perfect criteria match." },
          },
        })
      );
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toMatchObject({ status: "READY", overallScore: 100 });
  });

  it("returns null approxDurationMinutes when the session has no answers", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          shareableReportLink: null,
          sessionDetails: {
            skillReport: {},
            overallReport: {
              score: 5,
              metrics: {},
              overallSummary: "Ended early.",
            },
          },
        })
      );
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toMatchObject({ status: "READY", approxDurationMinutes: null });
  });

  it("returns null approxDurationMinutes instead of NaN when the last timestamp is malformed", async () => {
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          shareableReportLink: null,
          sessionDetails: {
            skillReport: {},
            answers: [{ timestamp: "ab:cd" }],
            overallReport: {
              score: 5,
              metrics: {},
              overallSummary: "Malformed timestamp from upstream.",
            },
          },
        })
      );
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toMatchObject({ status: "READY", approxDurationMinutes: null });
  });

  it("returns NOT_READY when the server responds 404", async () => {
    respond = (_req, res) => {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Report is not available for this candidate yet" }));
    };
    const { getInterviewReport } = await import("../interviewReports");

    const result = await getInterviewReport("INT_123", "USR_123");

    expect(result).toEqual({ status: "NOT_READY" });
  });

  it("re-throws non-404 errors", async () => {
    respond = (_req, res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "unauthorized", message: "bad key", status: 401 } }));
    };
    const { getInterviewReport } = await import("../interviewReports");

    await expect(getInterviewReport("INT_123", "USR_123")).rejects.toThrow("bad key");
  });
});
