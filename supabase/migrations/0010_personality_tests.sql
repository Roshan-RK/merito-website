create table if not exists personality_tests (
  user_id uuid not null references auth.users(id),
  role_title text not null,
  scores jsonb not null,
  validity jsonb not null,
  answers jsonb not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, role_title)
);

alter table personality_tests enable row level security;

drop policy if exists "Users can view their own personality tests" on personality_tests;

create policy "Users can view their own personality tests"
  on personality_tests
  for select
  using (auth.uid() = user_id);
