create table if not exists learned_skill_keywords (
  skill text primary key,
  first_seen_at timestamptz not null default now(),
  sample_job_title text
);

alter table learned_skill_keywords enable row level security;
