create table if not exists candidate_profile_overrides (
  user_id uuid primary key references auth.users(id),
  phone_number text,
  location text,
  total_experience numeric,
  updated_at timestamptz not null default now()
);
