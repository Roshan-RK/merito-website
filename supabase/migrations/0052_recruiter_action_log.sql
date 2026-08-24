-- 0050_recruiter_action_log.sql
--
-- Audit log for recruiter-side actions (distinct from admin_audit_log, which
-- is admin-actor only). Only actions where the recruiter's identity is
-- actually known at the time get logged here -- see lib/recruiterActionLog.ts
-- for which ones qualify. contact-detail-request (the browser extension's
-- reveal action) is deliberately NOT wired in: that route authenticates with
-- a single shared extension key, not a per-recruiter login, so there is no
-- real recruiter identity to attribute it to.

create table recruiter_action_log (
  id uuid primary key default gen_random_uuid(),
  recruiter_email text not null,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index recruiter_action_log_created_idx on recruiter_action_log(created_at desc);
alter table recruiter_action_log enable row level security;
-- No public policy: service-role access only, same pattern as admin_audit_log.
