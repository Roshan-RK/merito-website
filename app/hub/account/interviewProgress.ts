// The interview panel's candidate-facing statuses (the DB
// fitment_interviews.status values plus the synthetic "not_started" and
// "processing" -- the latter derived from ib_interview_status EVALUATING/
// EVALUATED while the report hasn't landed yet). Lives in its own module, not
// ProgressRail.tsx, so a server component can import the type without pulling
// in a "use client" module.
export type InterviewStatus = "not_started" | "invited" | "processing" | "terminated" | "stuck" | "ready";
