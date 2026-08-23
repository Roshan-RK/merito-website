-- Phase 3b cuts start-ai-interview's existing/priorAttempt matching over to
-- lead_id, but the DB-level guarantee from migration 0019 was still keyed on
-- role_title -- without this, two different leads that happen to share
-- role_title text could still race past the app-level check. Kept alongside
-- (not replacing) fitment_interviews_one_invited_per_role: legacy rows with
-- lead_id still null (pre-Phase-1, or a rare backfill miss) get no
-- protection from this new index, so the old one stays as their safety net.
create unique index if not exists fitment_interviews_one_invited_per_lead
  on fitment_interviews (user_id, lead_id)
  where status = 'invited';
