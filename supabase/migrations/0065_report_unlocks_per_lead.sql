-- 0065_report_unlocks_per_lead.sql
-- Completes 0012's intent (reverted by 0020 only because lib/reportUnlocks.ts
-- was never updated -- this change ships DB + every write path together).
-- report_unlocks was (user_id, role_title)-keyed, so two fitment_leads with
-- the same free-text role_title shared one paid report unlock. Re-key per lead.
--
-- The (user_id, role_title) PK is REPLACED, not kept: with the write path
-- migrated in the same branch, a second same-titled lead's unlock would
-- violate report_unlocks_pkey (captured payment, no grant) -- verified against
-- a real Postgres 15.6 container. The role_title column stays (denormalized,
-- human-readable), and legacy lead_id IS NULL rows keep a uniqueness
-- guarantee via a partial unique index.

begin;

-- 1. Replace the key. (Confirm the PK constraint name from Step 1's probe; the
--    Postgres default is report_unlocks_pkey.)
alter table report_unlocks drop constraint report_unlocks_pkey;

alter table report_unlocks
  add constraint report_unlocks_one_per_lead unique (user_id, lead_id);

create unique index report_unlocks_legacy_one_per_role
  on report_unlocks (user_id, role_title)
  where lead_id is null;

-- 2. Backfill lead_id on existing rows from the funding order (newest wins).
update report_unlocks ru
set lead_id = (
  select rt.lead_id
  from razorpay_transactions rt
  join fitment_leads fl on fl.id = rt.lead_id
  where rt.user_id = ru.user_id
    and fl.role_title = ru.role_title
    and rt.product in ('report', 'bundle')
    and rt.status = 'success'
    and rt.lead_id is not null
  order by rt.created_at desc
  limit 1
)
where ru.lead_id is null;

-- 3. A user who paid for two same-titled leads had only one row (old PK), so
--    step 2 attaches only the newest. Add the rows the collapsed key couldn't
--    hold: one per (user, lead) with a successful report/bundle order AND an
--    existing unlock for that role.
insert into report_unlocks (user_id, lead_id, role_title)
select distinct rt.user_id, rt.lead_id, fl.role_title
from razorpay_transactions rt
join fitment_leads fl on fl.id = rt.lead_id
where rt.product in ('report', 'bundle')
  and rt.status = 'success'
  and rt.lead_id is not null
  and exists (
    select 1 from report_unlocks ru
    where ru.user_id = rt.user_id and ru.role_title = fl.role_title
  )
on conflict (user_id, lead_id) do nothing;

commit;
