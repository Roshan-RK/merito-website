-- 0051_intervuebox_webhook_events.sql
--
-- Full IntervueBox webhook delivery history (Phase 5). pipeline_failures
-- only ever captures failure cases; this captures every signature-valid
-- delivery, plus the outcome of the sweep it triggered, for the admin
-- webhook inspector. The per-event payload shape isn't documented by
-- IntervueBox (see app/api/webhooks/intervuebox/route.ts), so raw_payload
-- is stored as opaque jsonb rather than parsed into typed columns.

create table intervuebox_webhook_events (
  id uuid primary key default gen_random_uuid(),
  raw_payload jsonb not null,
  sweep_result jsonb,
  sweep_error text,
  created_at timestamptz not null default now()
);
create index intervuebox_webhook_events_created_idx on intervuebox_webhook_events(created_at desc);
alter table intervuebox_webhook_events enable row level security;
-- No public policy: service-role access only, same pattern as admin_audit_log.
