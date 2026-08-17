alter table hub_notifications
  add column category text not null default 'general'
  check (category in ('general', 'report', 'personality', 'interview', 'references', 'payment', 'recruiter'));
