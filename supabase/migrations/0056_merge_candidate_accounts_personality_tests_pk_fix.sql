-- 0054_merge_candidate_accounts_personality_tests_pk_fix.sql
--
-- 0053_personality_tests_user_pk.sql changed personality_tests's primary key
-- from (user_id, role_title) to user_id alone. merge_candidate_accounts (see
-- 0034_admin_account_management.sql) still guarded its personality_tests
-- move on the old composite key: `k.role_title = t.role_title`. Since each
-- user can now have at most one personality_tests row, that guard is almost
-- always false, so the UPDATE fires even when keep_user_id already has its
-- own row -- violating the new single-column primary key and erroring the
-- merge whenever both accounts had completed a personality test.
--
-- Postgres functions are replaced whole, so this reproduces the entire
-- merge_candidate_accounts body from 0034 verbatim, changing only the
-- personality_tests clause's guard condition.

create or replace function merge_candidate_accounts(keep_user_id uuid, merge_user_id uuid)
returns jsonb
language plpgsql
as $$
declare
  n_fitment_leads bigint;
  n_report_unlocks bigint;
  n_fitment_interviews bigint;
  n_personality_tests bigint;
  n_reference_checks bigint;
  n_report_share_links bigint;
  n_contact_detail_requests bigint;
  n_recruiter_preview_settings bigint;
begin
  update fitment_leads set user_id = keep_user_id where user_id = merge_user_id;
  get diagnostics n_fitment_leads = row_count;

  update report_unlocks t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not exists (select 1 from report_unlocks k where k.user_id = keep_user_id and k.role_title = t.role_title);
  get diagnostics n_report_unlocks = row_count;

  update fitment_interviews t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not exists (select 1 from fitment_interviews k where k.user_id = keep_user_id and k.role_title = t.role_title);
  get diagnostics n_fitment_interviews = row_count;

  -- personality_tests is now keyed on user_id alone (0053), not
  -- (user_id, role_title) -- guard on keep_user_id having any row at all,
  -- not a role_title match, or this UPDATE violates the new single-column PK.
  update personality_tests t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not exists (select 1 from personality_tests k where k.user_id = keep_user_id);
  get diagnostics n_personality_tests = row_count;

  update reference_checks t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not (
        t.status in ('initiated', 'in_progress')
        and exists (
          select 1 from reference_checks k
          where k.user_id = keep_user_id and k.status in ('initiated', 'in_progress')
        )
      );
  get diagnostics n_reference_checks = row_count;

  update report_share_links t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not exists (select 1 from report_share_links k where k.user_id = keep_user_id and k.role_title = t.role_title);
  get diagnostics n_report_share_links = row_count;

  update contact_detail_requests t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not exists (select 1 from contact_detail_requests k where k.user_id = keep_user_id);
  get diagnostics n_contact_detail_requests = row_count;

  update recruiter_preview_settings t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not exists (select 1 from recruiter_preview_settings k where k.user_id = keep_user_id);
  get diagnostics n_recruiter_preview_settings = row_count;

  return jsonb_build_object(
    'fitment_leads', n_fitment_leads,
    'report_unlocks', n_report_unlocks,
    'fitment_interviews', n_fitment_interviews,
    'personality_tests', n_personality_tests,
    'reference_checks', n_reference_checks,
    'report_share_links', n_report_share_links,
    'contact_detail_requests', n_contact_detail_requests,
    'recruiter_preview_settings', n_recruiter_preview_settings
  );
end;
$$;
