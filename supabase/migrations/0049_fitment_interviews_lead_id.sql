-- supabase/migrations/0049_fitment_interviews_lead_id.sql
alter table fitment_interviews
  add column if not exists lead_id uuid references fitment_leads(id);

create index if not exists fitment_interviews_lead_id_idx on fitment_interviews(lead_id);

-- Backfill existing rows: match each interview to the most recent lead with
-- the same user_id + role_title at the time of the interview. This is a
-- best-effort match on the same fragile role_title text the app has always
-- used, kept only for historical rows -- new rows get lead_id set directly
-- at insert time (Task 3), never inferred.
update fitment_interviews fi
set lead_id = (
  select fl.id
  from fitment_leads fl
  where fl.user_id = fi.user_id
    and fl.role_title = fi.role_title
  order by fl.created_at desc
  limit 1
)
where fi.lead_id is null;
