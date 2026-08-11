alter table counselling_requests add column scheduled_at timestamptz;
alter table counselling_requests add column completed_at timestamptz;
alter table counselling_requests add column notes text;
