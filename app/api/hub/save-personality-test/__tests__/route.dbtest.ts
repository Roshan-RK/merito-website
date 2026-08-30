import { describe, it, expect, beforeEach, vi } from "vitest";
import { ALL_ITEM_IDS } from "@/lib/personality";
import {
  createTestUser,
  deleteTestUser,
  withTestUser,
  signedInClient,
  execSql,
  dbAdmin,
} from "@/test/dbtest/withTestUser";

/**
 * Real-DB counterpart to route.test.ts. That file `vi.mock`s `@/lib/supabase`,
 * so the `.upsert({ onConflict: "user_id" })` never touches a real schema and
 * the suite stayed green through the prod outage. Here only the auth-session
 * resolution is mocked (no cookies in node); `@/lib/supabase` is REAL, writing
 * to the local Supabase stack.
 */

const state = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
  }),
}));

const admin = dbAdmin();

function completeAnswers(rating = 3): Record<string, number> {
  return Object.fromEntries(ALL_ITEM_IDS.map((id) => [String(id), rating]));
}

async function post(body: unknown): Promise<Response> {
  const { POST } = await import("../route");
  return POST(
    new Request("http://localhost/api/hub/save-personality-test", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  state.user = null;
  vi.unstubAllEnvs();
});

describe("POST /api/hub/save-personality-test — real DB", () => {
  it("500s when personality_tests carries the pre-0055 composite PK (proves the schema is really exercised)", async () => {
    const t = await createTestUser(admin);
    state.user = t.user;
    vi.stubEnv("RAZORPAY_BYPASS", "true");

    // Re-introduce the schema the outage ran against: a composite PK means no
    // unique index on (user_id) alone, so onConflict:"user_id" raises 42P10.
    execSql(
      "alter table personality_tests drop constraint personality_tests_pkey;" +
        " alter table personality_tests add primary key (user_id, role_title);",
    );
    try {
      const res = await post({ roleTitle: "Backend Engineer", answers: completeAnswers() });
      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/something went wrong saving your results/i);
    } finally {
      execSql(
        "alter table personality_tests drop constraint personality_tests_pkey;" +
          " alter table personality_tests add primary key (user_id);",
      );
      await deleteTestUser(t);
    }
  });

  it("saves a complete answer set: 200 + { scores, validity } and one row lands", async () => {
    await withTestUser(async (t) => {
      state.user = t.user;
      vi.stubEnv("RAZORPAY_BYPASS", "true");

      const res = await post({ roleTitle: "Backend Engineer", answers: completeAnswers() });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty("scores");
      expect(json).toHaveProperty("validity");

      const { data } = await admin.from("personality_tests").select("*").eq("user_id", t.user.id);
      expect(data).toHaveLength(1);
      expect(data![0].role_title).toBe("Backend Engineer");
    });
  });

  it("a retake with a different role updates the one row in place — no 2nd row, no 23505", async () => {
    await withTestUser(async (t) => {
      state.user = t.user;
      vi.stubEnv("RAZORPAY_BYPASS", "true");

      expect((await post({ roleTitle: "Backend Engineer", answers: completeAnswers(2) })).status).toBe(200);
      expect((await post({ roleTitle: "Data Scientist", answers: completeAnswers(4) })).status).toBe(200);

      const { data } = await admin.from("personality_tests").select("role_title").eq("user_id", t.user.id);
      expect(data).toHaveLength(1);
      expect(data![0].role_title).toBe("Data Scientist");
    });
  });

  it("the saved row is visible to the candidate's own RLS-scoped read (as the account page does it)", async () => {
    await withTestUser(async (t) => {
      state.user = t.user;
      vi.stubEnv("RAZORPAY_BYPASS", "true");
      await post({ roleTitle: "Backend Engineer", answers: completeAnswers() });

      const asUser = await signedInClient(t);
      const { data } = await asUser
        .from("personality_tests")
        .select("role_title")
        .eq("user_id", t.user.id)
        .maybeSingle();

      expect(data?.role_title).toBe("Backend Engineer");
    });
  });

  it("402 when personality is not unlocked and bypass is off — nothing written", async () => {
    await withTestUser(async (t) => {
      state.user = t.user;
      vi.stubEnv("RAZORPAY_BYPASS", "false");

      const res = await post({ roleTitle: "Backend Engineer", answers: completeAnswers() });

      expect(res.status).toBe(402);
      const { data } = await admin.from("personality_tests").select("user_id").eq("user_id", t.user.id);
      expect(data).toHaveLength(0);
    });
  });

  it("200 once a product_unlocks row exists (bypass off)", async () => {
    await withTestUser(async (t) => {
      state.user = t.user;
      vi.stubEnv("RAZORPAY_BYPASS", "false");

      const { error } = await admin
        .from("product_unlocks")
        .insert({ user_id: t.user.id, product: "personality" });
      expect(error).toBeNull();

      const res = await post({ roleTitle: "Backend Engineer", answers: completeAnswers() });
      expect(res.status).toBe(200);
    });
  });

  it("401 with no session", async () => {
    state.user = null;
    vi.stubEnv("RAZORPAY_BYPASS", "true");
    expect((await post({ roleTitle: "X", answers: completeAnswers() })).status).toBe(401);
  });

  it("400 on an incomplete answer set", async () => {
    await withTestUser(async (t) => {
      state.user = t.user;
      vi.stubEnv("RAZORPAY_BYPASS", "true");
      expect((await post({ roleTitle: "X", answers: { "1": 3 } })).status).toBe(400);
    });
  });
});
