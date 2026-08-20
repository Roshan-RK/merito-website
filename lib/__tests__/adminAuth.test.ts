import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getUserMock = vi.fn();
const redirectMock = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

async function importAdminAuth() {
  return await import("../adminAuth");
}

describe("requireAdmin", () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;

  beforeEach(() => {
    getUserMock.mockReset();
    redirectMock.mockClear();
    notFoundMock.mockClear();
    process.env.ADMIN_EMAIL = "roshan@merito.in";
  });

  afterEach(() => {
    process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  it("redirects to /hub/login?next=/admin when no user is signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { requireAdmin } = await importAdminAuth();
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/hub/login?next=/admin");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("404s when the signed-in user is not the admin", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "candidate@example.com" } } });

    const { requireAdmin } = await importAdminAuth();
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns the user when they match ADMIN_EMAIL", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "roshan@merito.in" } } });

    const { requireAdmin } = await importAdminAuth();
    const user = await requireAdmin();

    expect(user).toEqual({ id: "u1", email: "roshan@merito.in" });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("throws when ADMIN_EMAIL is not configured", async () => {
    delete process.env.ADMIN_EMAIL;
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "roshan@merito.in" } } });

    const { requireAdmin } = await importAdminAuth();
    await expect(requireAdmin()).rejects.toThrow(/ADMIN_EMAIL/);
  });
});

describe("assertRecentAuth", () => {
  it("does not throw when last_sign_in_at is within the max age", async () => {
    const { assertRecentAuth } = await importAdminAuth();
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();

    expect(() => assertRecentAuth({ last_sign_in_at: recent })).not.toThrow();
  });

  it("throws ReauthRequiredError when last_sign_in_at exceeds the max age", async () => {
    const { assertRecentAuth, ReauthRequiredError } = await importAdminAuth();
    const stale = new Date(Date.now() - 31 * 60_000).toISOString();

    expect(() => assertRecentAuth({ last_sign_in_at: stale })).toThrow(ReauthRequiredError);
  });

  it("throws ReauthRequiredError when last_sign_in_at is missing", async () => {
    const { assertRecentAuth, ReauthRequiredError } = await importAdminAuth();

    expect(() => assertRecentAuth({})).toThrow(ReauthRequiredError);
  });

  it("respects a custom maxAgeMinutes", async () => {
    const { assertRecentAuth, ReauthRequiredError } = await importAdminAuth();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();

    expect(() => assertRecentAuth({ last_sign_in_at: tenMinutesAgo }, 5)).toThrow(ReauthRequiredError);
    expect(() => assertRecentAuth({ last_sign_in_at: tenMinutesAgo }, 15)).not.toThrow();
  });
});
