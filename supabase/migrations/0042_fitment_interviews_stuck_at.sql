-- Marks a fitment_interviews row as permanently stuck: has_resumed=true
-- (its one resume attempt was already used, see migration 0041) and the
-- next launch or resume attempt also failed at the vendor. See
-- docs/superpowers/specs/2026-08-19-interview-stuck-state-design.md.
alter table fitment_interviews
  add column if not exists stuck_at timestamptz;
