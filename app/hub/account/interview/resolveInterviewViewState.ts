// Which of the interview panel's six states page.tsx should render.
export type InterviewViewState = "locked" | "invited" | "appeared" | "terminated" | "ready" | "stuck";

export function resolveInterviewViewState(
  interview: { status: string; report_raw: unknown; ib_interview_status?: string | null; stuck_at?: string | null } | null | undefined
): InterviewViewState {
  // No row at all -- never paid or started.
  if (!interview) return "locked";
  // A row whose one resume attempt already failed again -- no self-service
  // path left, takes priority over every other state and is never cleared
  // automatically (see docs/superpowers/specs/2026-08-19-interview-stuck-state-design.md).
  if (interview.stuck_at) return "stuck";
  // A sweep-flipped "terminated" row always shows the resume card, regardless
  // of whatever raw candidate status happens to be cached alongside it.
  if (interview.status === "terminated") return "terminated";
  if (interview.status !== "ready" || !interview.report_raw) {
    return interview.ib_interview_status === "APPEARED" ? "appeared" : "invited";
  }
  return "ready";
}
