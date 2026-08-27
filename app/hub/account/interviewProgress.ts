// The interview panel's five candidate-facing statuses (the DB
// fitment_interviews.status values plus the synthetic "not_started"). Lives
// in its own module, not ProgressRail.tsx, so a server component can import
// the type without pulling in a "use client" module.
export type InterviewStatus = "not_started" | "invited" | "terminated" | "stuck" | "ready";
