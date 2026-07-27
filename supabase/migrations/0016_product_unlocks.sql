create table if not exists product_unlocks (
  user_id uuid not null references auth.users(id),
  product text not null check (product in ('personality', 'references')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, product)
);

alter table product_unlocks enable row level security;

drop policy if exists "Users can view their own product unlocks" on product_unlocks;

create policy "Users can view their own product unlocks"
  on product_unlocks
  for select
  using (auth.uid() = user_id);
