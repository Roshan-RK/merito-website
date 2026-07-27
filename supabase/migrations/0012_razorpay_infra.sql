create type product_type as enum ('report', 'personality', 'references', 'interview', 'counselling', 'bundle');
create type candidate_level as enum ('entry', 'mid', 'senior');

alter table fitment_leads
  add column if not exists candidate_level candidate_level;

-- Re-key report_unlocks from (user_id, role_title) to (user_id, lead_id).
-- Existing rows are backfilled to their most recent matching lead at the
-- time of this migration — an approximation, but the closest available
-- fact (there's no stored link from an old unlock row to the specific
-- lead it was unlocked for, since the old schema never tracked one).
alter table report_unlocks
  add column if not exists lead_id uuid references fitment_leads(id);

update report_unlocks ru
set lead_id = (
  select fl.id
  from fitment_leads fl
  where fl.user_id = ru.user_id and fl.role_title = ru.role_title
  order by fl.created_at desc
  limit 1
)
where lead_id is null;

delete from report_unlocks where lead_id is null;

alter table report_unlocks alter column lead_id set not null;
alter table report_unlocks drop constraint report_unlocks_pkey;
alter table report_unlocks add primary key (user_id, lead_id);

create table if not exists razorpay_transactions (
  order_id text primary key,
  payment_id text,
  user_id uuid not null references auth.users(id),
  product product_type not null,
  level candidate_level not null,
  lead_id uuid references fitment_leads(id),
  amount_paise integer not null,
  status text not null default 'initiated' check (status in ('initiated', 'success', 'failed')),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table razorpay_transactions enable row level security;

drop policy if exists "Users can view their own razorpay transactions" on razorpay_transactions;

create policy "Users can view their own razorpay transactions"
  on razorpay_transactions
  for select
  using (auth.uid() = user_id);
