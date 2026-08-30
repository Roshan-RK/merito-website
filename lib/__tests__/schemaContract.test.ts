import { describe, it, expect } from "vitest";
import {
  SCHEMA_CONTRACT,
  contractProbeSql,
  interpretProbeRows,
  verifySchemaContract,
  type SqlRow,
} from "@/lib/schemaContract";

/**
 * These test the pure logic with a fake `runSql`. The real DB run lives in
 * `scripts/check-schema-contract.mjs` (invoked by `npm run verify:schema` /
 * `prebuild`).
 */

/** rows as `contractProbeSql()` would return them when every check passes. */
const allOkRows = (): SqlRow[] => SCHEMA_CONTRACT.map((_, i) => ({ idx: i, ok: true }));

describe("SCHEMA_CONTRACT", () => {
  it("every check is well-formed", () => {
    expect(SCHEMA_CONTRACT.length).toBeGreaterThan(0);
    for (const check of SCHEMA_CONTRACT) {
      expect(check.name).toBeTruthy();
      expect(check.why).toBeTruthy();
      expect(check.sql).toMatch(/\bas ok\b/i);
    }
  });

  it("check names are unique", () => {
    const names = SCHEMA_CONTRACT.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("contractProbeSql", () => {
  it("emits one indexed select per check, unioned", () => {
    const sql = contractProbeSql();
    expect(sql.match(/union all/g) ?? []).toHaveLength(SCHEMA_CONTRACT.length - 1);
    SCHEMA_CONTRACT.forEach((_, i) => expect(sql).toContain(`select ${i} as idx`));
  });
});

describe("interpretProbeRows", () => {
  it("ok when every check row is ok", () => {
    expect(interpretProbeRows(allOkRows())).toEqual({ ok: true, failures: [] });
  });

  it("accepts stringy booleans from CLI JSON ('t' / 'true')", () => {
    const rows = SCHEMA_CONTRACT.map((_, i) => ({ idx: String(i), ok: i % 2 ? "t" : "true" }));
    expect(interpretProbeRows(rows).ok).toBe(true);
  });

  it("fails a check whose row is ok:false, and names it with its `why`", () => {
    const rows = allOkRows();
    rows[3] = { idx: 3, ok: false };
    const result = interpretProbeRows(rows);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([`${SCHEMA_CONTRACT[3].name}: ${SCHEMA_CONTRACT[3].why}`]);
  });

  it("fails a check the probe did not return a row for", () => {
    const rows = allOkRows().filter((r) => r.idx !== 0);
    const result = interpretProbeRows(rows);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([`${SCHEMA_CONTRACT[0].name}: ${SCHEMA_CONTRACT[0].why}`]);
  });

  it("empty rows -> every check fails", () => {
    expect(interpretProbeRows([]).failures).toHaveLength(SCHEMA_CONTRACT.length);
  });
});

describe("verifySchemaContract", () => {
  it("runs the probe SQL once and passes it through", async () => {
    let calls = 0;
    const runSql = async (sql: string) => {
      calls++;
      expect(sql).toBe(contractProbeSql());
      return allOkRows();
    };
    const result = await verifySchemaContract(runSql);
    expect(calls).toBe(1);
    expect(result.ok).toBe(true);
  });

  it("reports a probe-query failure as a contract failure (never a silent pass)", async () => {
    const runSql = async () => {
      throw new Error("relation does not exist");
    };
    const result = await verifySchemaContract(runSql);
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(["contract probe query failed — relation does not exist"]);
  });
});
