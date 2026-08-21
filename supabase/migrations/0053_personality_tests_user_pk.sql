-- Personality is candidate-level, not per-role (locked decision, see
-- plans/2026-08-21-multi-role-switcher-design.md). Keep only the newest row
-- per user_id -- ties on completed_at broken by role_title for a
-- deterministic result. User-approved: older duplicate per-role answers are
-- lost, not archived.
delete from personality_tests pt
where exists (
  select 1
  from personality_tests newer
  where newer.user_id = pt.user_id
    and (newer.completed_at, newer.role_title) > (pt.completed_at, pt.role_title)
);

alter table personality_tests drop constraint personality_tests_pkey;
alter table personality_tests add primary key (user_id);
