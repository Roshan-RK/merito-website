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
          interviewSessionId: "ISE_123",
          shareableReportLink: "https://app.intervuebox.com/reports/ISE_123",
          sessionDetails: {
            overallSkillScore: 85,
            skillReport: { technical: 85, communication: 90, problemSolving: 80 },
            overallReport: "Strong candidate.",
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
      overallSkillScore: 85,
      skillReport: { technical: 85, communication: 90, problemSolving: 80 },
      overallReport: "Strong candidate.",
      shareableReportLink: "https://app.intervuebox.com/reports/ISE_123",
    });
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
