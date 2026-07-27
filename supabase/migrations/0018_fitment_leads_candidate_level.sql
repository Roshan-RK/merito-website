alter table fitment_leads
  add column if not exists candidate_level text not null default 'mid'
  check (candidate_level in ('entry', 'mid', 'senior'));
