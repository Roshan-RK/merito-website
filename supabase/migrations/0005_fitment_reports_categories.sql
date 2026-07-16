do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'fitment_reports' and column_name = 'requirements'
  ) then
    alter table fitment_reports rename column requirements to categories;
  end if;
end $$;

alter table fitment_reports
  add column if not exists verdict_summary text not null default '';

alter table fitment_leads
  add column if not exists name text;
