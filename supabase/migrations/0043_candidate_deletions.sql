create table candidate_deletions (
  user_id uuid primary key references auth.users(id),
  requested_at timestamptz not null default now(),
  requested_by text not null,
  purge_after timestamptz not null,
  purged_at timestamptz
);

alter table candidate_deletions enable row level security;
-- No public policy: service-role access only, same pattern as admin_audit_log.
