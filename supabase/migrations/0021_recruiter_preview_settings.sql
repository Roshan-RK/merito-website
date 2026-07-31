create table if not exists recruiter_preview_settings (
  user_id uuid primary key references auth.users(id),
  enabled boolean not null default false,
  sections text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table recruiter_preview_settings enable row level security;

create policy "Users can view their own recruiter preview settings" on recruiter_preview_settings
  for select using (auth.uid() = user_id);
