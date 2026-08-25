alter table extension_lookups add column recruiter_email text;

create index if not exists extension_lookups_recruiter_email_idx
  on extension_lookups (recruiter_email);
