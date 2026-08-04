create table report_share_links (
  token text primary key,
  user_id uuid not null references auth.users(id),
  role_title text not null,
  include text not null,
  interview_sections text not null default '',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role_title)
);

alter table report_share_links enable row level security;

create policy "Users can view their own share links"
  on report_share_links
  for select
  using (auth.uid() = user_id);
