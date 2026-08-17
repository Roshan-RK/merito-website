import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("sendInterviewInvitation", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("posts candidate ids and returns invited/failed counts", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      success: true,
      invited: 1,
      failed: 0,
      results: [{ candidateId: "USR_123", success: true }],
    });
    const { sendInterviewInvitation } = await import("../invitations");

    const result = await sendInterviewInvitation("INT_123", ["USR_123"]);

    expect(result).toEqual({ invited: 1, failed: 0 });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/invitations/interviews/INT_123",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({ candidateIds: ["USR_123"] });
  });
});

describe("reinviteInterviewCandidates", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("posts to the /reinvite path, distinct from the initial-invite path", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      success: true,
      invited: 1,
      failed: 0,
      results: [{ candidateId: "USR_123", success: true }],
    });
    const { reinviteInterviewCandidates } = await import("../invitations");

    const result = await reinviteInterviewCandidates("INT_123", ["USR_123"]);

    expect(result).toEqual({ invited: 1, failed: 0 });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/invitations/interviews/INT_123/reinvite",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({ candidateIds: ["USR_123"] });
  });
});
