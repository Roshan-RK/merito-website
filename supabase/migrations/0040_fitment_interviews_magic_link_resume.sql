-- Adds magic-link storage and a resumable "terminated" status to
-- fitment_interviews. See docs/superpowers/specs/2026-08-19-intervuebox-magic-link-resume-voice-design.md.
alter table fitment_interviews
  add column if not exists magic_link text,
  add column if not exists magic_link_expires_at timestamptz,
  add column if not exists ib_interview_status text;

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.fitment_interviews'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table fitment_interviews drop constraint %I', con.conname);
  end loop;
end $$;

alter table fitment_interviews add constraint fitment_interviews_status_check
  check (status in ('invited', 'ready', 'terminated'));
