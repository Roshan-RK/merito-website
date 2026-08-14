import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock2 = vi.fn();
const eqMock1 = vi.fn(() => ({ eq: eqMock2 }));
const deleteMock = vi.fn(() => ({ eq: eqMock1 }));
const fromMock = vi.fn(() => ({ delete: deleteMock }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

describe("revokeProduct", () => {
  beforeEach(() => {
    fromMock.mockClear();
    deleteMock.mockClear();
    eqMock1.mockClear();
    eqMock2.mockClear();
    eqMock2.mockResolvedValue({ error: null });
  });

  it("deletes the product_unlocks row for the user and product", async () => {
    const { revokeProduct } = await import("../productUnlocks");

    await revokeProduct("user-1", "personality");

    expect(fromMock).toHaveBeenCalledWith("product_unlocks");
    expect(eqMock1).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqMock2).toHaveBeenCalledWith("product", "personality");
  });

  it("throws when the delete fails", async () => {
    eqMock2.mockResolvedValue({ error: { message: "db down" } });
    const { revokeProduct } = await import("../productUnlocks");

    await expect(revokeProduct("user-1", "references")).rejects.toThrow("Failed to revoke references");
  });
});
