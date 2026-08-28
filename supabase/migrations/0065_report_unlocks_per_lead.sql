-- 0065_report_unlocks_per_lead.sql
-- Completes 0012's intent (reverted by 0020 only because lib/reportUnlocks.ts
-- was never updated to write lead_id -- this change ships DB + code together).
-- report_unlocks was (user_id, role_title)-keyed, so two fitment_leads with
-- the same free-text role_title shared one paid report unlock. Re-key per
-- lead. Keep the (user_id, role_title) PK + role_title column for legacy
-- rows whose funding txn no longer carries a lead_id (purge migrations null
-- it) -- lib/reportUnlocks.ts falls back to a (role_title, lead_id IS NULL)
-- check for those.

-- Accurate backfill: the funding order row already stores the lead.
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

-- New per-lead uniqueness, alongside (not replacing) the legacy PK.
create unique index if not exists report_unlocks_one_per_lead
  on report_unlocks (user_id, lead_id)
  where lead_id is not null;
