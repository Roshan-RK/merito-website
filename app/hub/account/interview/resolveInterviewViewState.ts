// Which of the interview panel's five states page.tsx should render.
export type InterviewViewState = "locked" | "invited" | "appeared" | "terminated" | "ready";

export function resolveInterviewViewState(
  interview: { status: string; report_raw: unknown; ib_interview_status?: string | null } | null | undefined
): InterviewViewState {
  // No row at all -- never paid or started.
  if (!interview) return "locked";
  // A sweep-flipped "terminated" row always shows the resume card, regardless
  // of whatever raw candidate status happens to be cached alongside it.
  if (interview.status === "terminated") return "terminated";
  if (interview.status !== "ready" || !interview.report_raw) {
    return interview.ib_interview_status === "APPEARED" ? "appeared" : "invited";
  }
  return "ready";
}
