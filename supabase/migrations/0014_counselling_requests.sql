create table if not exists counselling_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  order_id text not null references razorpay_transactions(order_id),
  status text not null default 'requested' check (status in ('requested', 'scheduled', 'completed', 'cancelled')),
  requested_at timestamptz not null default now()
);

alter table counselling_requests enable row level security;

drop policy if exists "Users can view their own counselling requests" on counselling_requests;

create policy "Users can view their own counselling requests"
  on counselling_requests
  for select
  using (auth.uid() = user_id);
