-- Mirrors 0047 (fitment_leads.resume_match_overridden). Needed now that
-- Phase 5 adds a manual resync button for interview reports: report_raw was
-- previously safe from silent overwrite only because nothing ever re-touched
-- a "ready" row (see the comment this migration invalidates in
-- lib/adminCandidates.ts::overrideInterviewReport). A real lock is required
-- before resync can exist.
alter table fitment_interviews
  add column if not exists report_overridden boolean not null default false;
