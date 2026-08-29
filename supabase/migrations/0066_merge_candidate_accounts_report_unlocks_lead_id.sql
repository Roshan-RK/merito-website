-- 0066_merge_candidate_accounts_report_unlocks_lead_id.sql
--
-- 0065_report_unlocks_per_lead.sql re-keyed report_unlocks off its old
-- (user_id, role_title) primary key onto per-lead identity: it dropped
-- report_unlocks_pkey and added a non-partial unique (user_id, lead_id)
-- constraint (report_unlocks_one_per_lead), plus a partial unique index on
-- (user_id, role_title) where lead_id is null (report_unlocks_legacy_one_per_role)
-- so legacy null-lead_id rows keep a uniqueness guarantee. But
-- merge_candidate_accounts (last defined in
-- 0057_merge_candidate_accounts_fitment_interviews_lead_id.sql) still guarded
-- its report_unlocks move on role_title alone:
-- `k.role_title = t.role_title`. Post-0065 that guard is wrong two ways:
-- (a) it BLOCKS a legitimately-distinct per-lead unlock -- a merged-in paid
-- unlock for lead X, role "Analyst", is skipped whenever keep_user_id already
-- has any "Analyst" unlock for a *different* lead, so the candidate loses a
-- report they paid for; (b) it no longer matches the unique constraints it
-- exists to avoid violating (uniqueness is now on (user_id, lead_id), not
-- (user_id, role_title)).
--
-- Widen the guard to mirror the fitment_interviews clause already in this same
-- function: skip the move when keep_user_id already holds a row sharing lead
-- identity -- k.lead_id = t.lead_id when t.lead_id is set. The NULL branch
-- ((t.lead_id is null and k.lead_id is null and k.role_title = t.role_title))
-- still defends the partial report_unlocks_legacy_one_per_role unique index for
-- legacy rows that never got a lead_id.
--
-- Postgres functions are replaced whole, so this reproduces the entire
-- merge_candidate_accounts body from 0057 verbatim, changing only the
-- report_unlocks clause's not-exists guard.

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
      and not exists (
        select 1 from report_unlocks k
        where k.user_id = keep_user_id
          and (
            (t.lead_id is not null and k.lead_id = t.lead_id)
            or (t.lead_id is null and k.lead_id is null and k.role_title = t.role_title)
          )
      );
  get diagnostics n_report_unlocks = row_count;

  update fitment_interviews t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not exists (
        select 1 from fitment_interviews k
        where k.user_id = keep_user_id
          and (
            (t.lead_id is not null and k.lead_id = t.lead_id)
            or k.role_title = t.role_title
          )
      );
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
