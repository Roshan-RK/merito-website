create table if not exists fitment_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role_title text not null,
  jd_text text not null,
  jd_source text not null check (jd_source in ('paste', 'link')),
  score numeric not null check (score >= 0 and score <= 10),
  verdict text not null,
  created_at timestamptz not null default now()
);

create index if not exists fitment_leads_email_idx on fitment_leads (email);
