alter table fitment_reports
  drop column if exists strengths,
  drop column if exists gaps,
  drop column if exists cv_fixes;

alter table fitment_reports
  add column if not exists requirements jsonb not null default '[]'::jsonb,
  add column if not exists action_plan jsonb not null default '[]'::jsonb;
