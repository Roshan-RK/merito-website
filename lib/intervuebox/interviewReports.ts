import http from "http";
import https from "https";
import { IntervueBoxError, type IntervueBoxErrorShape } from "./client";

export type InterviewReportReady = {
  overallSkillScore: number;
  skillReport: Record<string, number>;
  overallReport: string;
  shareableReportLink: string | null;
};

export type InterviewReport = { status: "NOT_READY" } | ({ status: "READY" } & InterviewReportReady);

type RawInterviewReportResponse = {
  interviewSessionId: string;
  shareableReportLink: string | null;
  sessionDetails: {
    overallSkillScore: number;
    skillReport: Record<string, number>;
    overallReport: string;
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

export async function getInterviewReport(interviewId: string, candidateId: string): Promise<InterviewReport> {
  try {
    const response = await getWithBody<RawInterviewReportResponse>("/public/reports/interviews", {
      interviewId,
      candidateId,
    });
    return {
      status: "READY",
      overallSkillScore: response.sessionDetails.overallSkillScore,
      skillReport: response.sessionDetails.skillReport,
      overallReport: response.sessionDetails.overallReport,
      shareableReportLink: response.shareableReportLink,
    };
  } catch (err) {
    if (err instanceof IntervueBoxError && err.status === 404) {
      return { status: "NOT_READY" };
    }
    throw err;
  }
}
