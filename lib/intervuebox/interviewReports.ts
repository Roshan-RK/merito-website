import { intervueBoxFetch, IntervueBoxError } from "./client";

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

export async function getInterviewReport(interviewId: string, candidateId: string): Promise<InterviewReport> {
  try {
    const response = await intervueBoxFetch<RawInterviewReportResponse>("/public/reports/interviews", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId, candidateId }),
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
