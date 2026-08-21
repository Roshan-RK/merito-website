-- 0049_admin_recent_views.sql
--
-- Tracks the last candidate detail page each admin viewed, for a
-- "Recently viewed" shortcut list in the sidebar. Upserted on
-- (admin_email, candidate_user_id) -- one row per admin per candidate ever
-- viewed, most-recent viewed_at wins. candidate_email/candidate_name are
-- denormalized so the sidebar (rendered on every admin page load) never
-- needs a join.
--
-- Also closes two gaps found while touching this area:
-- 1. candidate_profile_overrides (0048) was missing RLS entirely, unlike
--    every other admin-only table (admin_rate_limit_events, candidate_deletions).
-- 2. candidate_profile_overrides was never added to purge_candidate_data()
--    (0044) -- rows for a purged candidate were silently orphaned.

create table admin_recent_views (
  admin_email text not null,
  candidate_user_id uuid not null,
  candidate_email text not null,
  candidate_name text,
  viewed_at timestamptz not null default now(),
  primary key (admin_email, candidate_user_id)
);
create index admin_recent_views_lookup_idx on admin_recent_views(admin_email, viewed_at desc);
alter table admin_recent_views enable row level security;
-- No public policy: service-role access only, same pattern as admin_audit_log.

alter table candidate_profile_overrides enable row level security;
-- No public policy: service-role access only -- missed when this table was added in 0048.

create or replace function purge_candidate_data(target_user_id uuid)
returns jsonb
language plpgsql
as $$
declare
  n_fitment_leads bigint;
  n_report_unlocks bigint;
  n_fitment_interviews bigint;
  n_personality_tests bigint;
  n_reference_tokens bigint;
  n_referees bigint;
  n_reference_checks bigint;
  n_report_share_links bigint;
  n_contact_detail_requests bigint;
  n_recruiter_preview_settings bigint;
  n_hub_notifications bigint;
  n_counselling_requests bigint;
  n_recruiter_jd_rescores bigint;
  n_product_unlocks bigint;
  n_extension_lookups_detached bigint;
  n_candidate_profile_overrides bigint;
  n_admin_recent_views bigint;
begin
  -- Detach external tables' FKs into this user's fitment_leads rows first --
  -- their rows are kept (payment ledger, ops log, recruiter's own sourcing
  -- history), only the reference to the about-to-be-deleted lead is cleared.
  update razorpay_transactions set lead_id = null
    where lead_id in (select id from fitment_leads where user_id = target_user_id);

  update pipeline_failures set lead_id = null
    where lead_id in (select id from fitment_leads where user_id = target_user_id);

  update recruiter_sourced_prospects set converted_lead_id = null
    where converted_lead_id in (select id from fitment_leads where user_id = target_user_id);

  -- reference_tokens -> referees -> reference_checks, in FK-safe child-first order.
  delete from reference_tokens
    where reference_id in (
      select r.id from referees r
      join reference_checks rc on rc.id = r.reference_check_id
      where rc.user_id = target_user_id
    );

  delete from referees t
    using reference_checks rc
    where t.reference_check_id = rc.id and rc.user_id = target_user_id;
  get diagnostics n_referees = row_count;

  delete from reference_checks where user_id = target_user_id;
  get diagnostics n_reference_checks = row_count;

  -- report_unlocks references fitment_leads(id) -- delete before fitment_leads.
  delete from report_unlocks where user_id = target_user_id;
  get diagnostics n_report_unlocks = row_count;

  delete from fitment_leads where user_id = target_user_id;
  get diagnostics n_fitment_leads = row_count;

  delete from fitment_interviews where user_id = target_user_id;
  get diagnostics n_fitment_interviews = row_count;

  delete from personality_tests where user_id = target_user_id;
  get diagnostics n_personality_tests = row_count;

  delete from report_share_links where user_id = target_user_id;
  get diagnostics n_report_share_links = row_count;

  delete from contact_detail_requests where user_id = target_user_id;
  get diagnostics n_contact_detail_requests = row_count;

  delete from recruiter_preview_settings where user_id = target_user_id;
  get diagnostics n_recruiter_preview_settings = row_count;

  delete from hub_notifications where user_id = target_user_id;
  get diagnostics n_hub_notifications = row_count;

  delete from counselling_requests where user_id = target_user_id;
  get diagnostics n_counselling_requests = row_count;

  delete from recruiter_jd_rescores where user_id = target_user_id;
  get diagnostics n_recruiter_jd_rescores = row_count;

  delete from product_unlocks where user_id = target_user_id;
  get diagnostics n_product_unlocks = row_count;

  update extension_lookups set matched_user_id = null where matched_user_id = target_user_id;
  get diagnostics n_extension_lookups_detached = row_count;

  delete from candidate_profile_overrides where user_id = target_user_id;
  get diagnostics n_candidate_profile_overrides = row_count;

  delete from admin_recent_views where candidate_user_id = target_user_id;
  get diagnostics n_admin_recent_views = row_count;

  return jsonb_build_object(
    'fitment_leads', n_fitment_leads,
    'report_unlocks', n_report_unlocks,
    'fitment_interviews', n_fitment_interviews,
    'personality_tests', n_personality_tests,
    'referees', n_referees,
    'reference_checks', n_reference_checks,
    'report_share_links', n_report_share_links,
    'contact_detail_requests', n_contact_detail_requests,
    'recruiter_preview_settings', n_recruiter_preview_settings,
    'hub_notifications', n_hub_notifications,
    'counselling_requests', n_counselling_requests,
    'recruiter_jd_rescores', n_recruiter_jd_rescores,
    'product_unlocks', n_product_unlocks,
    'extension_lookups_detached', n_extension_lookups_detached,
    'candidate_profile_overrides', n_candidate_profile_overrides,
    'admin_recent_views', n_admin_recent_views
  );
end;
$$;
