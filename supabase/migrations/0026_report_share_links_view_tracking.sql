alter table report_share_links add column view_count integer not null default 0;
alter table report_share_links add column last_viewed_at timestamptz;
