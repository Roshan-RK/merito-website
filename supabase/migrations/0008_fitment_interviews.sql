create table if not exists fitment_interviews (
  user_id uuid not null references auth.users(id),
  role_title text not null,
  ib_job_id text not null,
  ib_agent_id text not null,
  ib_candidate_id text not null,
  status text not null default 'invited' check (status in ('invited', 'ready')),
  report_raw jsonb,
  invited_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role_title)
);

alter table fitment_interviews enable row level security;

drop policy if exists "Users can view their own AI interviews" on fitment_interviews;

create policy "Users can view their own AI interviews"
  on fitment_interviews
  for select
  using (auth.uid() = user_id);
