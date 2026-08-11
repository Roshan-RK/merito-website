import { describe, it, expect, vi, beforeEach } from "vitest";

const selectMock = vi.fn();
const fromMock = vi.fn(() => ({ select: selectMock }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importModule() {
  return await import("../recruiterActivity");
}

describe("getRecruiterViewCount", () => {
  beforeEach(() => {
    fromMock.mockClear();
    selectMock.mockReset();
  });

  it("counts matched lookups for the user within the window", async () => {
    const eqMock = vi.fn();
    const gteMock = vi.fn().mockResolvedValue({ count: 4 });
    eqMock.mockReturnValue({ gte: gteMock });
    selectMock.mockReturnValue({ eq: eqMock });

    const { getRecruiterViewCount } = await importModule();
    const count = await getRecruiterViewCount("user-1");

    expect(fromMock).toHaveBeenCalledWith("extension_lookups");
    expect(selectMock).toHaveBeenCalledWith("*", { count: "exact", head: true });
    expect(eqMock).toHaveBeenCalledWith("matched_user_id", "user-1");
    expect(count).toBe(4);
  });

  it("returns 0 when count is null", async () => {
    const eqMock = vi.fn();
    const gteMock = vi.fn().mockResolvedValue({ count: null });
    eqMock.mockReturnValue({ gte: gteMock });
    selectMock.mockReturnValue({ eq: eqMock });

    const { getRecruiterViewCount } = await importModule();
    expect(await getRecruiterViewCount("user-1")).toBe(0);
  });
});
