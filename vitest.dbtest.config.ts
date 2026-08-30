import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { execFileSync } from "node:child_process";

/**
 * Real-DB integration tests (`*.dbtest.ts`).
 *
 * These hit a live local Supabase (`supabase start`) with NO schema mocking, so
 * they catch code-vs-schema drift the mocked `*.test.ts` suite structurally
 * cannot — that suite `vi.mock("@/lib/supabase")`s the DB away, which is exactly
 * why the personality-test outage passed CI while 100% broken in prod.
 *
 * Run: `npm run test:db` (needs `supabase start` first). This config resolves
 * the local URL + keys from `supabase status` and fails fast otherwise.
 */
function localSupabaseEnv(): Record<string, string> {
  let raw: string;
  try {
    raw = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", shell: true });
  } catch {
    throw new Error("`supabase status` failed — start the local stack first: `supabase start`.");
  }
  const get = (key: string) => raw.match(new RegExp(`^${key}="(.*)"$`, "m"))?.[1];
  const apiUrl = get("API_URL");
  const anonKey = get("ANON_KEY");
  const serviceKey = get("SERVICE_ROLE_KEY");
  if (!apiUrl || !anonKey || !serviceKey) {
    throw new Error("local Supabase is not running (no API_URL / keys from `supabase status`). Run `supabase start`.");
  }
  return {
    SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  };
}

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["**/*.dbtest.ts"],
    globalSetup: ["./test/dbtest/globalSetup.ts"],
    exclude: ["**/node_modules/**", ".next", ".worktrees", ".claude/worktrees", "extension"],
    env: localSupabaseEnv(),
    // Shared database state — never run these files in parallel.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
