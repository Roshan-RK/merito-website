-- Add "interview_invite_failed" kind: the IntervueBox invite chain itself
-- failed (candidate paid, vendor invite never confirmed) — distinct from the
-- existing "interview_invite_after_payment" kind, which means the vendor
-- invite DID succeed and only the local fitment_interviews write failed.
-- That distinction matters because the admin "Retry interview" action
-- (retryInterviewFromFailure in lib/pipelineFailures.ts) blindly inserts a
-- local row with status "invited" assuming the vendor side already sent the
-- invite — true for the existing kind, not true for this new one.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.pipeline_failures'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%kind%'
  loop
    execute format('alter table pipeline_failures drop constraint %I', con.conname);
  end loop;
end $$;

alter table pipeline_failures add constraint pipeline_failures_kind_check
  check (kind in ('interview_invite_after_payment', 'orphaned_ib_job', 'interview_invite_failed'));
