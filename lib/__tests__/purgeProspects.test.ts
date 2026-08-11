import { describe, it, expect, vi, beforeEach } from "vitest";

const deleteLtMock = vi.fn();
const fromMock = vi.fn(() => ({
  delete: () => ({
    lt: () => ({
      is: () => deleteLtMock(),
    }),
  }),
}));
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from: fromMock }) }));

async function importModule() {
  return await import("../purgeProspects");
}

describe("purgeStaleProspects", () => {
  beforeEach(() => deleteLtMock.mockReset());

  it("deletes unconverted prospects older than 90 days and returns the count", async () => {
    deleteLtMock.mockResolvedValue({ data: [{ id: "p1" }, { id: "p2" }], error: null });
    const { purgeStaleProspects } = await importModule();
    const result = await purgeStaleProspects();
    expect(result).toEqual({ purgedCount: 2 });
  });

  it("throws if the delete errors", async () => {
    deleteLtMock.mockResolvedValue({ data: null, error: { message: "db error" } });
    const { purgeStaleProspects } = await importModule();
    await expect(purgeStaleProspects()).rejects.toThrow();
  });
});
