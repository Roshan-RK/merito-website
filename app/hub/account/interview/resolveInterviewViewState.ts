// Which of the interview panel's three states page.tsx should render.
// Pulled out as a pure function (mirrors ProgressRail.tsx's
// isInterviewGenerating) so the branching is unit-testable without a
// Supabase-backed server component.
export type InterviewViewState = "locked" | "in_progress" | "ready";

export function resolveInterviewViewState(
  interview: { status: string; report_raw: unknown } | null | undefined
): InterviewViewState {
  // No row at all -- never paid or started.
  if (!interview) return "locked";
  // fitment_interviews.status is only ever "invited" or "ready" (db check
  // constraint) -- anything short of a ready row with its report attached
  // means payment already happened and the interview is running externally
  // on IntervueBox, not that it needs a paywall again.
  if (interview.status !== "ready" || !interview.report_raw) return "in_progress";
  return "ready";
}
