create table if not exists recruiter_jd_rescores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  jd_hash text not null,
  jd_text text not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  ib_job_id text,
  ib_applied_job_id text,
  resume_match_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, jd_hash)
);

alter table recruiter_jd_rescores enable row level security;
-- No candidate-facing policy: this table is recruiter-side only (server
-- service-role access exclusively), same enforcement model as the
-- non-candidate-visible parts of the recruiter-preview feature.
