/**
 * Schema-contract checks — the schema facts hot server queries depend on.
 *
 * Why this exists: the vitest suite `vi.mock("@/lib/supabase")`s the DB away, so
 * a route test stays green even when the deploy target's real Postgres is missing
 * a constraint / table / column the shipping code needs. That is exactly how the
 * personality-test outage shipped (prod's `personality_tests` still had the old
 * composite PK, so `.upsert({ onConflict: "user_id" })` `42P10`d in prod while
 * every CI path was green).
 *
 * This module is the loud gate: `verifySchemaContract` runs every check against
 * the DB a deploy is about to target; a failure means code and schema have
 * drifted apart.
 *
 * Pure logic only — no DB driver, no imports. The caller injects `runSql`
 * (see `scripts/check-schema-contract.mjs`). Unit-tested with a fake `runSql`.
 * See docs/superpowers/plans/2026-08-29-paid-flow-verification-plan.md.
 */

export type SqlRow = Record<string, unknown>;
export type RunSql = (sql: string) => Promise<ReadonlyArray<SqlRow>>;

export type ContractCheck = {
  /** Stable identifier, shown in the failure list. */
  name: string;
  /** What breaks at runtime if this fact is false. */
  why: string;
  /** Introspection SQL. Must return exactly one row exposing a boolean `ok`. */
  sql: string;
};

/** A table exists in the `public` schema. */
function tableExists(table: string, why: string): ContractCheck {
  return {
    name: `table ${table}`,
    why,
    sql: `select to_regclass('public.${table}') is not null as ok`,
  };
}

/** A column exists on a `public` table. */
function columnExists(table: string, column: string, why: string): ContractCheck {
  return {
    name: `column ${table}.${column}`,
    why,
    sql: `select exists(
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = '${table}' and column_name = '${column}'
    ) as ok`,
  };
}

/** A function exists in `public` with the given argument count. */
function functionExists(name: string, nargs: number, why: string): ContractCheck {
  return {
    name: `function ${name}(${nargs})`,
    why,
    sql: `select exists(
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = '${name}' and p.pronargs = ${nargs}
    ) as ok`,
  };
}

/**
 * A non-partial unique index covers exactly `columns` (order-insensitive —
 * Postgres infers an `ON CONFLICT (a, b)` target by column set). This is the
 * check that would have caught the outage: a `.upsert({ onConflict })` whose
 * target index does not exist (or is partial) raises `42P10` at runtime.
 */
function uniqueOn(table: string, columns: string[], why: string): ContractCheck {
  const literal = `array[${[...columns].sort().map((c) => `'${c}'`).join(", ")}]::text[]`;
  return {
    name: `unique ${table}(${columns.join(", ")})`,
    why,
    sql: `select exists(
      select 1 from pg_index x
      where x.indrelid = to_regclass('public.${table}')
        and x.indisunique
        and x.indpred is null
        and (
          select array_agg(a.attname::text order by a.attname::text)
          from pg_attribute a
          where a.attrelid = x.indrelid and a.attnum = any(x.indkey) and a.attnum > 0
        ) = ${literal}
    ) as ok`,
  };
}

export const SCHEMA_CONTRACT: ReadonlyArray<ContractCheck> = [
  // --- personality flow -----------------------------------------------------
  {
    name: "personality_tests PK is (user_id) only",
    why: 'save-personality-test upserts with onConflict:"user_id"; a composite PK makes that 42P10 in prod (the original outage)',
    sql: `select (
      count(*) = 1
      and bool_and(cardinality(c.conkey) = 1)
      and bool_and((
        select a.attname from pg_attribute a
        where a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      ) = 'user_id')
    ) as ok
    from pg_constraint c
    where c.conrelid = to_regclass('public.personality_tests') and c.contype = 'p'`,
  },
  {
    name: "personality_tests has the columns the route writes",
    why: "save-personality-test writes user_id, role_title, scores, validity, answers, completed_at",
    sql: `select count(*) = 6 as ok from information_schema.columns
      where table_schema = 'public' and table_name = 'personality_tests'
      and column_name in ('user_id','role_title','scores','validity','answers','completed_at')`,
  },

  // --- fitment check + AI interview flows ----------------------------------
  tableExists("fitment_leads", "fitment-check, razorpay, start-ai-interview all read/write it"),
  tableExists("fitment_interviews", "start-ai-interview, interview status/resume/launch-link read/write it"),
  columnExists("fitment_interviews", "lead_id", "start-ai-interview keys inserts + existing/priorAttempt lookups on lead_id (migration 0051)"),
  tableExists("razorpay_transactions", "every paid flow's payment gate reads it"),

  // --- reference-check flow ----------------------------------------------
  tableExists("reference_checks", "referenceChecks lib reads/writes it across the referee + initiate surfaces"),
  tableExists("referees", "referenceChecks lib reads/writes per-referee rows"),

  // --- report unlock / cross-flow ---------------------------------------
  tableExists("report_unlocks", "reportUnlocks + razorpay finalize + adminPayments read/write it"),
  uniqueOn(
    "report_unlocks",
    ["user_id", "lead_id"],
    "migration 0065 re-keyed this to a non-partial unique (user_id, lead_id); reportUnlocks relies on the 23505 it raises",
  ),
  uniqueOn("product_unlocks", ["user_id", "product"], 'productUnlocks upserts with onConflict:"user_id,product"'),
  functionExists("merge_candidate_accounts", 2, 'adminCandidates.rpc("merge_candidate_accounts") on the account-merge path'),
  functionExists("purge_candidate_data", 1, 'purgeCandidates.rpc("purge_candidate_data") on the candidate-purge cron'),

  // --- recruiter-preview surfaces (public lookup reads these) -----------
  tableExists("recruiter_candidate_checks", "recruiterChecks lib reads/writes it"),
  tableExists("recruiter_preview_sections", "public recruiter-preview lookup reads it"),
  tableExists("recruiter_preview_audit", "recruiterPreviewAudit lib writes it"),
  columnExists("extension_lookups", "recruiter_email", "extensionLookups + adminAnalytics filter on recruiter_email"),

  // --- remaining onConflict targets (the 42P10 class) ------------------
  uniqueOn("learned_skill_keywords", ["skill"], 'learnedSkills upserts with onConflict:"skill"'),
  uniqueOn("admin_recent_views", ["admin_email", "candidate_user_id"], 'adminRecentViews upserts with onConflict:"admin_email,candidate_user_id"'),
  uniqueOn("recruiter_identities", ["email"], 'recruiterIdentity upserts with onConflict:"email"'),
  uniqueOn("recruiter_preview_settings", ["user_id"], 'recruiter-preview + adminCandidates upsert with onConflict:"user_id"'),
  uniqueOn("candidate_profile_overrides", ["user_id"], 'adminCandidates upserts with onConflict:"user_id"'),
];

/**
 * The whole contract as one query: one row per check, `idx` + boolean `ok`.
 * One round trip instead of N — `runSql` against the linked project goes over
 * the Management API and each call is slow.
 */
export function contractProbeSql(): string {
  return SCHEMA_CONTRACT.map(
    (c, i) => `select ${i} as idx, coalesce((select ok from (${c.sql}) _s${i}), false) as ok`,
  ).join("\nunion all\n");
}

/** Interpret the rows `contractProbeSql()` returned. */
export function interpretProbeRows(rows: ReadonlyArray<SqlRow>): { ok: boolean; failures: string[] } {
  const passed = new Set(
    rows.filter((r) => r.ok === true || r.ok === "true" || r.ok === "t").map((r) => Number(r.idx)),
  );
  const failures = SCHEMA_CONTRACT.flatMap((c, i) =>
    passed.has(i) ? [] : [`${c.name}: ${c.why}`],
  );
  return { ok: failures.length === 0, failures };
}

/**
 * Run the contract against a real database. `runSql` executes one SQL string and
 * returns its rows. A probe-query failure is itself reported as a contract
 * failure (never a silent pass).
 */
export async function verifySchemaContract(
  runSql: RunSql,
): Promise<{ ok: boolean; failures: string[] }> {
  let rows: ReadonlyArray<SqlRow>;
  try {
    rows = await runSql(contractProbeSql());
  } catch (err) {
    return { ok: false, failures: [`contract probe query failed — ${(err as Error).message}`] };
  }
  return interpretProbeRows(rows);
}
