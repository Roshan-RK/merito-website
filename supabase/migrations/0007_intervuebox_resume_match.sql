alter table fitment_leads
  add column if not exists ib_job_id text,
  add column if not exists ib_resume_id text,
  add column if not exists ib_applied_job_id text,
  add column if not exists resume_match_status text check (resume_match_status in ('PENDING', 'READY')),
  add column if not exists resume_match_score numeric check (resume_match_score is null or (resume_match_score >= 0 and resume_match_score <= 100)),
  add column if not exists resume_match_raw jsonb;
