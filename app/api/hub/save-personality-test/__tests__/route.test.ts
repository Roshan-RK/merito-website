import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ALL_ITEM_IDS } from "@/lib/personality";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

const isProductUnlockedMock = vi.fn();
vi.mock("@/lib/productUnlocks", () => ({
  isProductUnlocked: isProductUnlockedMock,
}));

const upsertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: () => ({ upsert: upsertMock }) }),
}));

async function importRoute() {
  return await import("../route");
}

function completeAnswers(): Record<string, number> {
  const answers: Record<string, number> = {};
  ALL_ITEM_IDS.forEach((id) => {
    answers[id] = 3;
  });
  return answers;
}

describe("POST /api/hub/save-personality-test — payment gate", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    isProductUnlockedMock.mockReset();
    upsertMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 402 when personality is not unlocked and bypass is off", async () => {
    vi.stubEnv("RAZORPAY_BYPASS", "false");
    isProductUnlockedMock.mockResolvedValue(false);
    const { POST } = await importRoute();

    const request = new Request("http://localhost/api/hub/save-personality-test", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Backend Engineer", answers: completeAnswers() }),
    });
    const response = await POST(request);

    expect(response.status).toBe(402);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("proceeds when personality is unlocked and bypass is off", async () => {
    vi.stubEnv("RAZORPAY_BYPASS", "false");
    isProductUnlockedMock.mockResolvedValue(true);
    const { POST } = await importRoute();

    const request = new Request("http://localhost/api/hub/save-personality-test", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Backend Engineer", answers: completeAnswers() }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", role_title: "Backend Engineer" }),
      { onConflict: "user_id" }
    );
  });

  it("proceeds without checking unlock status when bypass is on (default)", async () => {
    const { POST } = await importRoute();

    const request = new Request("http://localhost/api/hub/save-personality-test", {
      method: "POST",
      body: JSON.stringify({ roleTitle: "Backend Engineer", answers: completeAnswers() }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(isProductUnlockedMock).not.toHaveBeenCalled();
  });
});
