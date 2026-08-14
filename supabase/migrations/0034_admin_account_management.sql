-- 0034_admin_account_management.sql

create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  prior_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_target_idx on admin_audit_log(target_type, target_id, created_at desc);
alter table admin_audit_log enable row level security;
-- No public policy: service-role access only, same pattern as recruiter_identities.

alter table recruiter_identities add column banned_at timestamptz;

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

  update personality_tests t set user_id = keep_user_id
    where t.user_id = merge_user_id
      and not exists (select 1 from personality_tests k where k.user_id = keep_user_id and k.role_title = t.role_title);
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
