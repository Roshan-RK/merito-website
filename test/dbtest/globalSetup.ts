import { execSql } from "./withTestUser";

/**
 * Prod's `public` tables carry DML grants for anon / authenticated /
 * service_role that came from Supabase's legacy auto-expose behaviour — the
 * migrations never GRANT them explicitly. A fresh local `supabase start` +
 * migration replay does not reproduce those grants, so supabase-js (which
 * connects as `service_role`) hits `42501 permission denied`.
 *
 * Mirror prod once, before the dbtest suite runs. This is a test fixture, not a
 * migration — the missing explicit grants are tracked separately (BACKLOG:
 * `auto_expose_new_tables` is removed from Supabase on 2026-10-30).
 */
export default function setup(): void {
  execSql(`
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    grant all on all routines in schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
}
