-- fitment_interviews' primary key (user_id, role_title) allows only one
-- interview row ever per role, which is why retakes were structurally
-- impossible — the route just returned the existing row's status instead
-- of starting a new interview. Give it a surrogate key so history is kept
-- across attempts, and use a partial unique index to still guarantee only
-- one attempt is ever "invited" (in progress) for a role at a time.
alter table fitment_interviews add column if not exists id uuid not null default gen_random_uuid();
alter table fitment_interviews drop constraint if exists fitment_interviews_pkey;
alter table fitment_interviews add primary key (id);

create index if not exists fitment_interviews_user_role_idx
  on fitment_interviews (user_id, role_title);

create unique index if not exists fitment_interviews_one_invited_per_role
  on fitment_interviews (user_id, role_title)
  where status = 'invited';
