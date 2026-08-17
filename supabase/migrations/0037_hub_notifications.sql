create table if not exists hub_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  created_by text
);
create index hub_notifications_user_unread_idx on hub_notifications(user_id, created_at) where read_at is null;
alter table hub_notifications enable row level security;

drop policy if exists "Users can view their own notifications" on hub_notifications;

create policy "Users can view their own notifications"
  on hub_notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can mark their own notifications read" on hub_notifications;

create policy "Users can mark their own notifications read"
  on hub_notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
