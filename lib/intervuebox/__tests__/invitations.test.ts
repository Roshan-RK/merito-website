import { describe, it, expect, vi, beforeEach } from "vitest";

const intervueBoxFetchMock = vi.fn();
vi.mock("../client", () => ({
  intervueBoxFetch: intervueBoxFetchMock,
}));

describe("sendInterviewInvitation", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("sends accessMode MAGIC_LINK and returns the magic link", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      success: true,
      accessMode: "MAGIC_LINK",
      invited: 1,
      failed: 0,
      results: [
        {
          candidateId: "USR_123",
          success: true,
          magicLink: "https://portal/auth/magic?token=abc",
          magicLinkExpiresAt: "2026-08-20T10:00:00.000Z",
        },
      ],
    });
    const { sendInterviewInvitation } = await import("../invitations");

    const result = await sendInterviewInvitation("INT_123", ["USR_123"]);

    expect(result).toEqual({
      invited: 1,
      failed: 0,
      magicLink: "https://portal/auth/magic?token=abc",
      magicLinkExpiresAt: "2026-08-20T10:00:00.000Z",
    });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/invitations/interviews/INT_123",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({ candidateIds: ["USR_123"], accessMode: "MAGIC_LINK" });
  });

  it("returns null magic link fields when the vendor omits them", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      success: true,
      accessMode: "MAGIC_LINK",
      invited: 0,
      failed: 1,
      results: [],
    });
    const { sendInterviewInvitation } = await import("../invitations");

    const result = await sendInterviewInvitation("INT_123", ["USR_123"]);

    expect(result).toEqual({ invited: 0, failed: 1, magicLink: null, magicLinkExpiresAt: null });
  });
});

describe("reinviteInterviewCandidates", () => {
  beforeEach(() => {
    intervueBoxFetchMock.mockReset();
  });

  it("defaults to mode REINVITE when no mode is passed", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      success: true,
      mode: "REINVITE",
      accessModes: ["MAGIC_LINK"],
      reinvited: 1,
      failed: 0,
      candidateIds: ["USR_123"],
    });
    const { reinviteInterviewCandidates } = await import("../invitations");

    const result = await reinviteInterviewCandidates("INT_123", ["USR_123"]);

    expect(result).toEqual({ invited: 1, failed: 0, magicLinks: undefined, errors: undefined });
    expect(intervueBoxFetchMock).toHaveBeenCalledWith(
      "/public/invitations/interviews/INT_123/reinvite",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({ candidateIds: ["USR_123"], mode: "REINVITE" });
  });

  it("sends mode RESUME and returns magicLinks when passed explicitly", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      success: true,
      mode: "RESUME",
      accessModes: ["MAGIC_LINK"],
      reinvited: 1,
      failed: 0,
      candidateIds: ["USR_123"],
      magicLinks: [{ candidateId: "USR_123", magicLink: "https://portal/auth/magic?token=xyz", expiresAt: "2026-08-20T10:00:00.000Z" }],
    });
    const { reinviteInterviewCandidates } = await import("../invitations");

    const result = await reinviteInterviewCandidates("INT_123", ["USR_123"], "RESUME");

    expect(result.magicLinks).toEqual([
      { candidateId: "USR_123", magicLink: "https://portal/auth/magic?token=xyz", expiresAt: "2026-08-20T10:00:00.000Z" },
    ]);
    const sentBody = JSON.parse(intervueBoxFetchMock.mock.calls[0][1].body);
    expect(sentBody).toEqual({ candidateIds: ["USR_123"], mode: "RESUME" });
  });

  it("returns errors when the vendor reports a partial failure", async () => {
    intervueBoxFetchMock.mockResolvedValue({
      success: true,
      mode: "RESUME",
      accessModes: ["CREDENTIALS"],
      reinvited: 0,
      failed: 1,
      candidateIds: [],
      errors: [{ candidateId: "USR_123", error: "Cannot resume an interview in status EVALUATED. Use mode=REINVITE to start a new attempt." }],
    });
    const { reinviteInterviewCandidates } = await import("../invitations");

    const result = await reinviteInterviewCandidates("INT_123", ["USR_123"], "RESUME");

    expect(result).toEqual({
      invited: 0,
      failed: 1,
      magicLinks: undefined,
      errors: [{ candidateId: "USR_123", error: "Cannot resume an interview in status EVALUATED. Use mode=REINVITE to start a new attempt." }],
    });
  });
});
