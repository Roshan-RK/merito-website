alter table fitment_leads
  add column if not exists resume_match_overridden boolean not null default false;
