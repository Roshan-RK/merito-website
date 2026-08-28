-- Only has_resumed rows escalate to stuck_at today (see interviewStuck.ts).
-- A first-time launch/resume that keeps failing at the vendor (e.g. the IB
-- job was cleaned up vendor-side) has no escalation path. Count consecutive
-- vendor failures so the 2nd one can flag the row stuck for ops too.
alter table fitment_interviews
  add column if not exists launch_fail_count integer not null default 0;
