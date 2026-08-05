create table extension_lookups (
  id uuid primary key default gen_random_uuid(),
  linkedin_url text not null,
  matched_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table extension_lookups enable row level security;
