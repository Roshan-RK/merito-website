-- report_unlocks was re-keyed to (user_id, lead_id) in 0012_razorpay_infra.sql,
-- and no code path sets role_title anymore (lib/reportUnlocks.ts only writes
-- user_id/lead_id) -- but the original NOT NULL constraint from
-- 0003_dashboard_report_unlock.sql was left in place, so every unlock write
-- fails with "null value in column role_title violates not-null constraint".
alter table report_unlocks alter column role_title drop not null;
