import { describe, it, expect, vi } from "vitest";
import { markInterviewStuck } from "../interviewStuck";

describe("markInterviewStuck", () => {
  it("sets stuck_at to an ISO timestamp on the given row", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    const admin = { from: vi.fn().mockReturnValue({ update: updateMock }) } as unknown as Parameters<typeof markInterviewStuck>[0];

    await markInterviewStuck(admin, "row-1");

    expect(admin.from).toHaveBeenCalledWith("fitment_interviews");
    expect(updateMock).toHaveBeenCalledWith({ stuck_at: expect.any(String) });
    expect(eqMock).toHaveBeenCalledWith("id", "row-1");
  });

  it("logs but doesn't throw when the update itself fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const eqMock = vi.fn().mockResolvedValue({ error: new Error("db down") });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    const admin = { from: vi.fn().mockReturnValue({ update: updateMock }) } as unknown as Parameters<typeof markInterviewStuck>[0];

    await expect(markInterviewStuck(admin, "row-1")).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to mark fitment_interviews row stuck",
      expect.objectContaining({ rowId: "row-1" })
    );

    consoleErrorSpy.mockRestore();
  });
});
