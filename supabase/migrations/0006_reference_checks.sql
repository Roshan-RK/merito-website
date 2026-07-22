create type reference_check_status as enum ('initiated', 'in_progress', 'completed', 'cancelled');
create type referee_status as enum ('pending', 'completed', 'rejected');
create type referee_experience_level as enum ('fresher', 'experienced');

create table reference_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  status reference_check_status not null default 'initiated',
  min_references int not null default 3,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index reference_checks_one_active_per_user
  on reference_checks (user_id)
  where status in ('initiated', 'in_progress');

create table referees (
  id uuid primary key default gen_random_uuid(),
  reference_check_id uuid not null references reference_checks(id),
  name text not null,
  email text not null,
  phone text,
  linkedin_url text,
  organization text,
  experience_level referee_experience_level,
  role text not null,
  custom_role text,
  ratings jsonb,
  overall_feedback text,
  status referee_status not null default 'pending',
  reminder_count int not null default 0,
  last_reminded_at timestamptz,
  feedback_opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reference_check_id, email)
);

create table reference_tokens (
  token text primary key,
  reference_id uuid not null references referees(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table reference_checks enable row level security;
alter table referees enable row level security;
alter table reference_tokens enable row level security;

create policy "Users can view their own reference checks"
  on reference_checks
  for select
  using (auth.uid() = user_id);

create policy "Users can view their own referees"
  on referees
  for select
  using (
    exists (
      select 1 from reference_checks
      where reference_checks.id = referees.reference_check_id
      and reference_checks.user_id = auth.uid()
    )
  );
