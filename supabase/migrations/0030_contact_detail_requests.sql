create table contact_detail_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  linkedin_url text not null,
  role_title text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  unique (user_id)
);

alter table contact_detail_requests enable row level security;
