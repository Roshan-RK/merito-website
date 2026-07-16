alter table fitment_leads
  add column if not exists cv_text text;

create table if not exists report_unlocks (
  user_id uuid not null references auth.users(id),
  role_title text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, role_title)
);

alter table report_unlocks enable row level security;

drop policy if exists "Users can view their own report unlocks" on report_unlocks;

create policy "Users can view their own report unlocks"
  on report_unlocks
  for select
  using (auth.uid() = user_id);

create table if not exists fitment_reports (
  user_id uuid not null references auth.users(id),
  role_title text not null,
  strengths text[] not null,
  gaps text[] not null,
  cv_fixes text[] not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, role_title)
);

alter table fitment_reports enable row level security;

drop policy if exists "Users can view their own fitment reports" on fitment_reports;

create policy "Users can view their own fitment reports"
  on fitment_reports
  for select
  using (auth.uid() = user_id);
