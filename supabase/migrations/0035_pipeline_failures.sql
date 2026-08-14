create table pipeline_failures (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('interview_invite_after_payment', 'orphaned_ib_job')),
  user_id uuid,
  lead_id uuid references fitment_leads(id),
  order_id text references razorpay_transactions(order_id),
  detail jsonb not null,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);
create index pipeline_failures_unresolved_idx on pipeline_failures(kind, created_at) where resolved_at is null;
alter table pipeline_failures enable row level security;
-- No public policy: service-role access only.
