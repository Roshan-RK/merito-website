import { spawnSync } from "node:child_process";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Test-user lifecycle for `*.dbtest.ts` — a real `auth.users` row against the
 * local Supabase stack, hard-deleted (children first; the FKs to `auth.users`
 * are NO ACTION) on teardown.
 */

export type TestUser = {
  user: User;
  email: string;
  password: string;
  admin: SupabaseClient;
};

/** Service-role client for the local stack (env set by vitest.dbtest.config.ts). */
export function dbAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("dbtest env missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Candidate-scoped tables to clear before deleting the user. Children before
 * parents; extend as more flows get dbtests.
 */
const USER_SCOPED_TABLES = [
  "personality_tests",
  "product_unlocks",
  "report_unlocks",
  "reference_checks",
  "fitment_interviews",
  "fitment_leads",
] as const;

export async function createTestUser(admin: SupabaseClient = dbAdmin()): Promise<TestUser> {
  const email = `dbtest+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "dbtest-Password-123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message ?? "no user"}`);
  return { user: data.user, email, password, admin };
}

export async function deleteTestUser(t: TestUser): Promise<void> {
  for (const table of USER_SCOPED_TABLES) {
    await t.admin.from(table).delete().eq("user_id", t.user.id);
  }
  const { error } = await t.admin.auth.admin.deleteUser(t.user.id);
  if (error) throw new Error(`deleteTestUser failed: ${error.message}`);
}

/** Create a test user, run `fn`, always clean up. */
export async function withTestUser<T>(fn: (t: TestUser) => Promise<T>): Promise<T> {
  const t = await createTestUser();
  try {
    return await fn(t);
  } finally {
    await deleteTestUser(t);
  }
}

/**
 * Raw (possibly multi-statement) SQL against the local stack, for DDL that
 * supabase-js cannot run. Goes straight to the local Postgres container via
 * `psql` — `supabase db query` wraps input in a prepared statement and rejects
 * multiple commands.
 */
const DB_CONTAINER = "supabase_db_merito-website-v2";

export function execSql(sql: string): void {
  const res = spawnSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    { input: sql, encoding: "utf8" },
  );
  if (res.status !== 0) {
    throw new Error(`execSql failed: ${(res.stderr || res.stdout || res.error?.message || "").trim()}`);
  }
}

/** An RLS-scoped client signed in as the test user — reads as the page would. */
export async function signedInClient(t: TestUser): Promise<SupabaseClient> {
  const url = process.env.SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: t.email, password: t.password });
  if (error) throw new Error(`signedInClient failed: ${error.message}`);
  return client;
}
