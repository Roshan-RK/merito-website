alter table fitment_leads
  add column if not exists user_id uuid references auth.users(id);

create index if not exists fitment_leads_user_id_idx on fitment_leads (user_id);

alter table fitment_leads enable row level security;

create policy "Users can view their own claimed fitment leads"
  on fitment_leads
  for select
  using (auth.uid() = user_id);
