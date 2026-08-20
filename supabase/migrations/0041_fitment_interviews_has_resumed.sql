-- Tracks whether a fitment_interviews row has ever gone through the resume
-- flow. Live testing (2026-08-19) found IntervueBox's RESUME-mode reinvite
-- can return the same magicLink token as the prior session, which then
-- 404s at their own /auth/magic verify endpoint on the very next open --
-- silently leaving the candidate on a dead cached link with no error and
-- no path back to a working resume card. Once a row has ever been resumed,
-- launch-link stops trusting its cached magic_link and always requests a
-- fresh one from the vendor instead, so a stale link is never served twice.
alter table fitment_interviews
  add column if not exists has_resumed boolean not null default false;
