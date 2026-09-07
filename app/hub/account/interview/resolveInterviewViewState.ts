// Which of the interview panel's states page.tsx should render.
export type InterviewViewState = "locked" | "invited" | "appeared" | "processing" | "terminated" | "ready" | "stuck";

export function resolveInterviewViewState(
  interview: { status: string; report_raw: unknown; ib_interview_status?: string | null; stuck_at?: string | null } | null | undefined
): InterviewViewState {
  // No row at all -- never paid or started.
  if (!interview) return "locked";
  // A genuinely completed, scored interview always wins -- a stuck_at flag
  // set before the report arrived (candidate resumed, finished, then hit
  // "Start Interview" again before the report landed, triggering a doomed
  // resume call against an already-EVALUATED vendor session) must never
  // hide a report the candidate already paid for. stuck_at is never cleared
  // automatically, so this check has to come first, not just be reordered
  // temporarily. See docs/superpowers/specs/2026-08-19-interview-stuck-state-design.md.
  if (interview.status === "ready" && interview.report_raw) return "ready";
  // A row whose one resume attempt already failed again -- no self-service
  // path left, takes priority over every other state and is never cleared
  // automatically (see docs/superpowers/specs/2026-08-19-interview-stuck-state-design.md).
  if (interview.stuck_at) return "stuck";
  // A sweep-flipped "terminated" row always shows the resume card, regardless
  // of whatever raw candidate status happens to be cached alongside it.
  if (interview.status === "terminated") return "terminated";
  // The candidate finished; IntervueBox is scoring it (EVALUATING) or has
  // scored it (EVALUATED) but the report hasn't been pulled into report_raw
  // yet. Show a "scoring your interview" card -- NOT the pre-interview "Start
  // Interview" card the plain "invited" fallthrough would render.
  if (
    (interview.ib_interview_status === "EVALUATING" || interview.ib_interview_status === "EVALUATED") &&
    !interview.report_raw
  ) {
    return "processing";
  }
  if (interview.status !== "ready" || !interview.report_raw) {
    return interview.ib_interview_status === "APPEARED" ? "appeared" : "invited";
  }
  return "ready";
}
