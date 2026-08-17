import { describe, it, expect } from "vitest";
import { buildApplicationRows, type FitmentLeadRow } from "../applicationHistory";

function lead(overrides: Partial<FitmentLeadRow>): FitmentLeadRow {
  return {
    id: "lead_1",
    role_title: "Backend Engineer",
    score: 7.8,
    resume_match_status: "READY",
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildApplicationRows", () => {
  it("formats a READY lead's score to one decimal", () => {
    const rows = buildApplicationRows([lead({ score: 7.75, resume_match_status: "READY" })]);
    expect(rows[0].scoreLabel).toBe("7.8");
    expect(rows[0].statusLabel).toBe("Report ready");
  });

  it("shows a placeholder score and 'Processing' status for a PENDING lead", () => {
    const rows = buildApplicationRows([lead({ score: 0, resume_match_status: "PENDING" })]);
    expect(rows[0].scoreLabel).toBe("—");
    expect(rows[0].statusLabel).toBe("Processing");
  });

  it("treats a null resume_match_status as still processing", () => {
    const rows = buildApplicationRows([lead({ resume_match_status: null })]);
    expect(rows[0].statusLabel).toBe("Processing");
    expect(rows[0].scoreLabel).toBe("—");
  });

  it("formats the date as day/short-month/year", () => {
    const rows = buildApplicationRows([lead({ created_at: "2026-03-05T00:00:00.000Z" })]);
    expect(rows[0].dateLabel).toBe("5 Mar 2026");
  });

  it("sorts rows newest-first regardless of input order", () => {
    const rows = buildApplicationRows([
      lead({ id: "old", created_at: "2026-01-01T00:00:00.000Z" }),
      lead({ id: "new", created_at: "2026-06-01T00:00:00.000Z" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("carries the role title through unchanged", () => {
    const rows = buildApplicationRows([lead({ role_title: "Cloud Support Engineer" })]);
    expect(rows[0].roleTitle).toBe("Cloud Support Engineer");
  });
});
