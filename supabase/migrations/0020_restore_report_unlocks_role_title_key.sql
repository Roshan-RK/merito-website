-- 0012_razorpay_infra.sql re-keyed report_unlocks to (user_id, lead_id) and
-- set lead_id NOT NULL, anticipating an app-code change (lib/reportUnlocks.ts
-- writing lead_id instead of role_title) that never actually shipped -- every
-- current write path (lib/reportUnlocks.ts, lib/razorpay/finalize.ts) still
-- upserts/deletes by (user_id, role_title) alone. Since 0012, every report
-- unlock write has failed with "no unique or exclusion constraint matching
-- ON CONFLICT specification" because that's no longer the table's key.
-- Restore the (user_id, role_title) uniqueness the code actually relies on.
-- lead_id stays as a nullable, currently-unused column rather than being
-- dropped, since existing rows already have it backfilled.
--
-- One live row already has role_title = null (0015 made it nullable,
-- assuming wrongly that no code set it anymore) -- backfill it from
-- fitment_leads via lead_id before the new key can be added, same join
-- 0012 itself used for its original backfill. Any row that still can't
-- resolve a role_title this way is an orphaned artifact with no way to
-- identify what it was for, so it's dropped rather than left blocking
-- every future unlock write.
update report_unlocks ru
set role_title = fl.role_title
from fitment_leads fl
where ru.role_title is null and ru.lead_id = fl.id;

delete from report_unlocks where role_title is null;

alter table report_unlocks drop constraint report_unlocks_pkey;
alter table report_unlocks alter column lead_id drop not null;
alter table report_unlocks add primary key (user_id, role_title);
