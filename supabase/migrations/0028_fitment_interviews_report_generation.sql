-- Tracks whether we've already asked IntervueBox to generate a report for a
-- terminated interview (POST /public/reports/interviews/generate). Without
-- this, the self-heal poll would re-request generation on every 15s tick
-- while the row is still "invited".
alter table fitment_interviews
  add column if not exists report_generation_requested_at timestamptz;
