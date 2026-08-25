create table if not exists recruiter_candidate_checks (
  id uuid primary key default gen_random_uuid(),
  recruiter_email text not null references recruiter_identities(email),
  user_id uuid not null references auth.users(id),
  jd_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists recruiter_candidate_checks_recruiter_month_idx
  on recruiter_candidate_checks (recruiter_email, created_at);

alter table recruiter_candidate_checks enable row level security;
-- No candidate/recruiter-facing policy: service-role access only, same
-- enforcement model as recruiter_jd_rescores and recruiter_sourced_prospects.
