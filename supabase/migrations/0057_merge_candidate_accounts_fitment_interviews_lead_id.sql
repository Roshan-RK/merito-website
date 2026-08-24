-- 0055_merge_candidate_accounts_fitment_interviews_lead_id.sql
--
-- 0049_fitment_interviews_lead_id.sql added a lead_id column to
-- fitment_interviews, but merge_candidate_accounts (see
-- 0054_merge_candidate_accounts_personality_tests_pk_fix.sql) still guarded
-- its fitment_interviews move on the old role_title identity alone:
-- `k.role_title = t.role_title`. fitment_interviews has no unique constraint
-- on lead_id (fitment_interviews_lead_id_idx is a plain, non-unique btree)
-- and a user can legitimately have many interview rows sharing a user_id --
-- one per role, ever -- so this is not a PK-collision bug like the prior
-- personality_tests fix, and role_title-only matching cannot in practice
-- miss a duplicate here either: each lead belongs to one user, fitment_leads
-- moves first (above), and t/k are already scoped to two different
-- user_ids by this UPDATE's own WHERE/NOT EXISTS clauses, so a genuine
-- `k.lead_id = t.lead_id` collision across those two users is not something
-- this guard needs to defend against. This change is defensive symmetry
-- with this phase's app-level rule of treating lead_id (when set) and
-- role_title as equally valid identity keys for fitment_interviews
-- everywhere else in the codebase (see lib/postgrestIdentityFilter.ts) --
-- not a fix for an observed duplicate. Widen the guard so it skips the move
-- when keep_user_id already has a row sharing EITHER identity key --
-- lead_id (when set) or role_title.
--
-- Postgres functions are replaced whole, so this reproduces the entire
-- merge_candidate_accounts body from 0054 verbatim, changing only the
-- fitment_interviews clause's guard condition.

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
