create table if not exists recruiter_identities (
  email text primary key,
  verified_at timestamptz,
  verification_token text,
  verification_sent_at timestamptz
);

create index if not exists recruiter_identities_verification_token_idx
  on recruiter_identities (verification_token);

alter table recruiter_identities enable row level security;
-- No candidate/recruiter-facing policy: service-role access only, same
-- enforcement model as recruiter_jd_rescores.

create table if not exists recruiter_sourced_prospects (
  id uuid primary key default gen_random_uuid(),
  recruiter_email text not null references recruiter_identities(email),
  linkedin_url text not null,
  candidate_name text,
  candidate_level text not null check (candidate_level in ('entry', 'mid', 'senior')),
  jd_text text not null,
  jd_hash text not null,
  ib_job_id text,
  ib_resume_id text,
  ib_applied_job_id text,
  resume_match_raw jsonb,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  shortlisted boolean not null default false,
  shortlisted_at timestamptz,
  claim_token text unique,
  converted_lead_id uuid references fitment_leads(id),
  created_at timestamptz not null default now()
);

create index if not exists recruiter_sourced_prospects_recruiter_month_idx
  on recruiter_sourced_prospects (recruiter_email, created_at);

create index if not exists recruiter_sourced_prospects_claim_token_idx
  on recruiter_sourced_prospects (claim_token);

alter table recruiter_sourced_prospects enable row level security;
-- No candidate/recruiter-facing policy: service-role access only.

alter table fitment_leads drop constraint if exists fitment_leads_jd_source_check;
alter table fitment_leads add constraint fitment_leads_jd_source_check
  check (jd_source in ('paste', 'link', 'recruiter_sourced'));
