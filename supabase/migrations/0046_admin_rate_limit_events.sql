-- 0046_admin_rate_limit_events.sql

create table admin_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action_key text not null,
  created_at timestamptz not null default now()
);
create index admin_rate_limit_events_lookup_idx on admin_rate_limit_events(admin_email, action_key, created_at);
alter table admin_rate_limit_events enable row level security;
-- No public policy: service-role access only, same pattern as admin_audit_log.
