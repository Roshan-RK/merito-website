import http from "http";
import https from "https";
import { IntervueBoxError, type IntervueBoxErrorShape } from "./client";

export type InterviewReportReady = {
  overallScore: number; // 0-10, per sessionDetails.overallReport.score
  skillMetrics: Record<string, number>; // 0-10 each, per sessionDetails.overallReport.metrics
  overallSummary: string;
  strengths: string | null;
  areasOfImprovement: string | null;
  shareableReportLink: string | null;
  approxDurationMinutes: number | null;
};

export type InterviewReport = { status: "NOT_READY" } | ({ status: "READY" } & InterviewReportReady);

// Live-confirmed against the real API (2026-07-23): the documented
// `sessionDetails.overallSkillScore` / `sessionDetails.overallReport` (string)
// / `sessionDetails.skillReport` shape doesn't match what the API actually
// returns. The real overall score, per-skill metrics, and narrative summary
// all live nested under `sessionDetails.overallReport` (an object), and
// `sessionDetails.skillReport` is empty. `feedbackToInterviewer` and `rank`
// also exist on the real payload but are recruiter-facing (contain a blunt
// pass/fail recommendation) — deliberately not surfaced to the candidate.
type RawInterviewReportResponse = {
  shareableReportLink: string | null;
  sessionDetails: {
    // Only used for an approximate interview duration — the last answer's
    // timestamp is a proxy for total elapsed time, not a true recording-length
    // field (IntervueBox doesn't expose one). Never presented as exact.
    answers?: Array<{ timestamp: string }>;
    overallReport: {
      score: number;
      metrics: Record<string, number>;
      overallSummary: string;
      strengths?: string;
      areasOfImprovement?: string;
    };
  };
};

function requireEnv(name: "INTERVUEBOX_API_KEY" | "INTERVUEBOX_BASE_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`IntervueBox is not configured (${name} missing).`);
  }
  return value;
}

// IntervueBox's `GET /public/reports/interviews` genuinely requires a JSON
// body on a GET request (confirmed verbatim in their own docs' curl/JS/Python
// examples). The Fetch spec — and therefore Node's native `fetch`, which
// `intervueBoxFetch` wraps — throws `TypeError: Request with GET/HEAD method
// cannot have body` for this. GET-with-body is a valid HTTP construct, just
// not expressible via Fetch, so this one endpoint issues the request via
// Node's raw http/https modules instead of going through `intervueBoxFetch`.
function getWithBody<T>(path: string, body: unknown): Promise<T> {
  const apiKey = requireEnv("INTERVUEBOX_API_KEY");
  const baseUrl = requireEnv("INTERVUEBOX_BASE_URL").replace(/\/$/, "");
  const url = new URL(`${baseUrl}${path}`);
  const payload = JSON.stringify(body);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise<T>((resolve, reject) => {
    const request = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          let parsed: unknown = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = null;
          }
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            const errorShape = (parsed as { error?: Partial<IntervueBoxErrorShape> } | null)?.error ?? {};
            reject(
              new IntervueBoxError({
                code: errorShape.code ?? "unknown_error",
                message: errorShape.message ?? `IntervueBox request failed with status ${status}`,
                status: errorShape.status ?? status,
                details: errorShape.details,
              })
            );
            return;
          }
          resolve(parsed as T);
        });
      }
    );
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

function parseTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function computeApproxDurationMinutes(answers: Array<{ timestamp: string }> | undefined): number | null {
  if (!answers || answers.length === 0) return null;
  const lastTimestamp = answers[answers.length - 1].timestamp;
  const minutes = Math.ceil(parseTimestampToSeconds(lastTimestamp) / 60);
  return Number.isFinite(minutes) ? minutes : null;
}

export async function getInterviewReport(interviewId: string, candidateId: string): Promise<InterviewReport> {
  try {
    const response = await getWithBody<RawInterviewReportResponse>("/public/reports/interviews", {
      interviewId,
      candidateId,
    });
    const overallReport = response.sessionDetails.overallReport;
    return {
      status: "READY",
      overallScore: overallReport.score,
      skillMetrics: overallReport.metrics,
      overallSummary: overallReport.overallSummary,
      strengths: overallReport.strengths ?? null,
      areasOfImprovement: overallReport.areasOfImprovement ?? null,
      shareableReportLink: response.shareableReportLink,
      approxDurationMinutes: computeApproxDurationMinutes(response.sessionDetails.answers),
    };
  } catch (err) {
    if (err instanceof IntervueBoxError && err.status === 404) {
      return { status: "NOT_READY" };
    }
    throw err;
  }
}
