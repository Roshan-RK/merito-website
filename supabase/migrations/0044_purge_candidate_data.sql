-- 0044_purge_candidate_data.sql
--
-- Fast-follow to 0043's soft-delete: erases a candidate's personal-data rows
-- once their candidate_deletions.purge_after date passes. Called by
-- lib/purgeCandidates.ts via the daily /api/cron/candidate-purge job.
--
-- razorpay_transactions is deliberately NOT purged (no name/email columns to
-- strip, and user_id is not-null -- kept indefinitely for financial-record
-- retention). pipeline_failures.user_id is left dangling too (ops/debug log,
-- no FK constraint on that column). Both tables' lead_id/order_id FKs into
-- fitment_leads are detached below so the candidate's leads can still be deleted.
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
    'extension_lookups_detached', n_extension_lookups_detached
  );
end;
$$;
