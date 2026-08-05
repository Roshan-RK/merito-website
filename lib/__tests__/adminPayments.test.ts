import { describe, it, expect } from "vitest";
import { findUnpaidUnlocks } from "../adminPayments";

describe("findUnpaidUnlocks", () => {
  it("flags a report unlock with no matching transaction", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [{ userId: "u1", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" }],
      productUnlocks: [],
      successfulTransactions: [],
    });

    expect(result).toEqual([
      { userId: "u1", kind: "report", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" },
    ]);
  });

  it("does not flag a report unlock covered by a matching report transaction", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [{ userId: "u1", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" }],
      productUnlocks: [],
      successfulTransactions: [{ userId: "u1", product: "report", leadId: "lead-1" }],
    });

    expect(result).toEqual([]);
  });

  it("does not flag a report unlock covered by a bundle transaction for the same user", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [{ userId: "u1", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" }],
      productUnlocks: [],
      successfulTransactions: [{ userId: "u1", product: "bundle", leadId: "lead-1" }],
    });

    expect(result).toEqual([]);
  });

  it("still flags a report unlock when a report transaction exists for a different lead", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [{ userId: "u1", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" }],
      productUnlocks: [],
      successfulTransactions: [{ userId: "u1", product: "report", leadId: "lead-2" }],
    });

    expect(result).toEqual([
      { userId: "u1", kind: "report", leadId: "lead-1", roleTitle: "PM", unlockedAt: "2026-08-01T00:00:00Z" },
    ]);
  });

  it("flags a personality unlock with no matching transaction", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [],
      productUnlocks: [{ userId: "u1", product: "personality", unlockedAt: "2026-08-01T00:00:00Z" }],
      successfulTransactions: [],
    });

    expect(result).toEqual([
      { userId: "u1", kind: "personality", leadId: null, roleTitle: null, unlockedAt: "2026-08-01T00:00:00Z" },
    ]);
  });

  it("does not flag a personality unlock covered by a bundle transaction", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [],
      productUnlocks: [{ userId: "u1", product: "personality", unlockedAt: "2026-08-01T00:00:00Z" }],
      successfulTransactions: [{ userId: "u1", product: "bundle", leadId: "lead-1" }],
    });

    expect(result).toEqual([]);
  });

  it("does not flag a references unlock covered by a matching references transaction", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [],
      productUnlocks: [{ userId: "u1", product: "references", unlockedAt: "2026-08-01T00:00:00Z" }],
      successfulTransactions: [{ userId: "u1", product: "references", leadId: null }],
    });

    expect(result).toEqual([]);
  });

  it("ignores transactions belonging to a different user", () => {
    const result = findUnpaidUnlocks({
      reportUnlocks: [],
      productUnlocks: [{ userId: "u1", product: "personality", unlockedAt: "2026-08-01T00:00:00Z" }],
      successfulTransactions: [{ userId: "u2", product: "personality", leadId: null }],
    });

    expect(result).toEqual([
      { userId: "u1", kind: "personality", leadId: null, roleTitle: null, unlockedAt: "2026-08-01T00:00:00Z" },
    ]);
  });
});
