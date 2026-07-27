import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn();
const selectMock = vi.fn();
const eqUserMock = vi.fn();
const eqProductMock = vi.fn();
const maybeSingleMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("unlockProduct", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    fromMock.mockReset();
    fromMock.mockReturnValue({ upsert: upsertMock });
  });

  it("upserts a product_unlocks row on (user_id, product)", async () => {
    upsertMock.mockResolvedValue({ error: null });
    const { unlockProduct } = await import("../productUnlocks");

    await unlockProduct("user-1", "personality");

    expect(fromMock).toHaveBeenCalledWith("product_unlocks");
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: "user-1", product: "personality" },
      { onConflict: "user_id,product" }
    );
  });

  it("throws when the upsert fails", async () => {
    upsertMock.mockResolvedValue({ error: { message: "db error" } });
    const { unlockProduct } = await import("../productUnlocks");

    await expect(unlockProduct("user-1", "references")).rejects.toThrow("Failed to unlock references");
  });
});

describe("isProductUnlocked", () => {
  beforeEach(() => {
    selectMock.mockReset();
    eqUserMock.mockReset();
    eqProductMock.mockReset();
    maybeSingleMock.mockReset();
    fromMock.mockReset();
    fromMock.mockReturnValue({ select: selectMock });
    selectMock.mockReturnValue({ eq: eqUserMock });
    eqUserMock.mockReturnValue({ eq: eqProductMock });
    eqProductMock.mockReturnValue({ maybeSingle: maybeSingleMock });
  });

  it("returns true when a matching row exists", async () => {
    maybeSingleMock.mockResolvedValue({ data: { user_id: "user-1" }, error: null });
    const { isProductUnlocked } = await import("../productUnlocks");

    const result = await isProductUnlocked("user-1", "personality");

    expect(result).toBe(true);
    expect(eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqProductMock).toHaveBeenCalledWith("product", "personality");
  });

  it("returns false when no matching row exists", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { isProductUnlocked } = await import("../productUnlocks");

    const result = await isProductUnlocked("user-1", "references");

    expect(result).toBe(false);
  });

  it("throws when the query errors", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "db error" } });
    const { isProductUnlocked } = await import("../productUnlocks");

    await expect(isProductUnlocked("user-1", "personality")).rejects.toThrow("Failed to check personality unlock status");
  });
});
