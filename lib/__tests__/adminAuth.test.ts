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
    process.env.ADMIN_EMAIL = "rushi.humbe@gmail.com";
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
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "rushi.humbe@gmail.com" } } });

    const { requireAdmin } = await importAdminAuth();
    const user = await requireAdmin();

    expect(user).toEqual({ id: "u1", email: "rushi.humbe@gmail.com" });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("throws when ADMIN_EMAIL is not configured", async () => {
    delete process.env.ADMIN_EMAIL;
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "rushi.humbe@gmail.com" } } });

    const { requireAdmin } = await importAdminAuth();
    await expect(requireAdmin()).rejects.toThrow(/ADMIN_EMAIL/);
  });
});
