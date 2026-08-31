#!/usr/bin/env node
/**
 * Runs SCHEMA_CONTRACT against a real database and exits non-zero on drift.
 *
 * This is the recurrence gate for the personality-test outage: a deploy that
 * ships code needing a migration that was never applied fails here, loudly,
 * instead of 500ing every user in prod while CI stays green.
 *
 * Usage:
 *   node scripts/check-schema-contract.mjs [--linked | --local | --db-url <url>]
 *
 *   --linked   (default) the linked Supabase project, via `supabase db query`
 *   --local    the local `supabase start` stack
 *   --db-url   an explicit postgres connection string
 *
 * `runSql` shells out to the Supabase CLI (`supabase db query`). When the CLI
 * is absent or the project is not linked — e.g. inside the Vercel build image —
 * the check SKIPS with a warning and exit 0, so it never breaks a deploy it
 * cannot verify. It exits 1 only on a genuine contract failure. Run it locally
 * (`npm run verify:schema`) before pushing schema-dependent code; it also runs
 * automatically as `prebuild`.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifySchemaContract } from "../lib/schemaContract.ts";

const argv = process.argv.slice(2);
let mode = ["--linked"];
const dbUrlIdx = argv.indexOf("--db-url");
if (dbUrlIdx !== -1) mode = ["--db-url", `"${argv[dbUrlIdx + 1]}"`];
else if (argv.includes("--local")) mode = ["--local"];

const dir = mkdtempSync(join(tmpdir(), "schema-contract-"));
const sqlFile = join(dir, "check.sql");
const cleanup = () => rmSync(dir, { recursive: true, force: true });

// shell:true so Windows resolves `supabase.cmd`; every SQL string is passed via
// a file (`-f`), never as a shell-split positional arg.
function supabase(args) {
  return spawnSync("supabase", args, { encoding: "utf8", shell: true, maxBuffer: 1 << 24 });
}

function query(sqlText) {
  writeFileSync(sqlFile, sqlText);
  return supabase(["db", "query", ...mode, "--output-format", "json", "-f", `"${sqlFile}"`]);
}

function extractJson(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`no JSON in CLI output: ${stdout.slice(0, 200)}`);
  return JSON.parse(stdout.slice(start, end + 1));
}

function lastLines(s, n) {
  return (s || "").trim().split(/\r?\n/).slice(-n).join(" ");
}

/** Missing CLI / unlinked project / no network -> SKIP, not FAIL. */
function preflight() {
  if (supabase(["--version"]).status !== 0) {
    return { ok: false, reason: "`supabase` CLI not found on PATH" };
  }
  const probe = query("select 1 as ok");
  if (probe.status !== 0) {
    return { ok: false, reason: `\`supabase db query ${mode[0]}\` failed: ${lastLines(probe.stderr || probe.stdout, 2)}` };
  }
  try {
    const parsed = extractJson(probe.stdout);
    if (parsed._tag === "Error" || parsed.error || parsed._tag === "Help") {
      return { ok: false, reason: `\`supabase db query ${mode[0]}\` unusable: ${lastLines(probe.stdout, 1)}` };
    }
  } catch (err) {
    return { ok: false, reason: `could not parse \`supabase db query\` output: ${err.message}` };
  }
  return { ok: true };
}

async function main() {
  const pre = preflight();
  if (!pre.ok) {
    cleanup();
    console.warn(`\n⚠  schema-contract check SKIPPED — ${pre.reason}.`);
    console.warn("   Run `npm run verify:schema` locally before deploying schema-dependent code.\n");
    process.exit(0);
  }

  const runSql = async (sql) => {
    const res = query(sql);
    // The real SQL error is JSON on stdout; stderr is just CLI progress noise.
    let parsed;
    try {
      parsed = extractJson(res.stdout);
    } catch {
      throw new Error(lastLines(res.stderr || res.stdout, 3) || `exit ${res.status}`);
    }
    if (parsed._tag === "Error" || parsed.error) {
      throw new Error(parsed.error?.message ?? JSON.stringify(parsed));
    }
    if (res.status !== 0) throw new Error(lastLines(res.stderr, 3) || `exit ${res.status}`);
    return parsed.rows ?? [];
  };

  let result;
  try {
    result = await verifySchemaContract(runSql);
  } finally {
    cleanup();
  }

  const target = mode[0].replace("--", "");
  if (result.ok) {
    console.log(`\n✓  schema-contract check passed against ${target} (${result.failures.length} failures).\n`);
    process.exit(0);
  }

  console.error(`\n✗  schema-contract check FAILED against ${target} — ${result.failures.length} drift(s):\n`);
  for (const f of result.failures) console.error(`   • ${f}`);
  console.error(
    "\nThe deploy target's schema is missing something the shipping code needs." +
      "\nApply the outstanding migration(s) before deploying, or fix the contract if the code changed.\n",
  );
  process.exit(1);
}

main().catch((err) => {
  cleanup();
  console.error("\n✗  schema-contract check crashed:", err);
  process.exit(1);
});
