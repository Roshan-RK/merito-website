import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const leadMaybeSingleMock = vi.fn();
const leadLimitMock = vi.fn().mockReturnValue({ maybeSingle: leadMaybeSingleMock });
const leadOrderMock = vi.fn().mockReturnValue({ limit: leadLimitMock });
const leadEqMock = vi.fn().mockReturnValue({ order: leadOrderMock });
const leadSelectMock = vi.fn().mockReturnValue({ eq: leadEqMock });
const sessionFromMock = vi.fn().mockReturnValue({ select: leadSelectMock });

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: sessionFromMock,
  }),
}));

const createOrderMock = vi.fn();
vi.mock("@/lib/razorpay/client", () => ({
  createOrder: createOrderMock,
}));

const insertMock = vi.fn();
const adminFromMock = vi.fn().mockReturnValue({ insert: insertMock });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: adminFromMock }),
}));

async function importRoute() {
  return await import("../route");
}

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/hub/razorpay/initiate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/hub/razorpay/initiate", () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    getUserMock.mockReset();
    leadMaybeSingleMock.mockReset();
    leadMaybeSingleMock.mockResolvedValue({ data: { candidate_level: "senior" }, error: null });
    createOrderMock.mockReset();
    createOrderMock.mockResolvedValue({ orderId: "order_ABC123" });
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
  });

  it("returns 401 when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ product: "counselling" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for an unknown product", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "rushi@example.com" } } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ product: "not-a-product" }));
    expect(response.status).toBe(400);
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("returns 400 for report (report has its own dedicated route, not this generic one)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "rushi@example.com" } } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ product: "report" }));
    expect(response.status).toBe(400);
  });

  it("creates an order priced by the candidate's most recent level and returns checkout details", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "rushi@example.com" } } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ product: "counselling" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("checkout");
    expect(body.orderId).toBe("order_ABC123");
    expect(body.amountPaise).toBe(299900); // counselling @ senior level
    expect(body.currency).toBe("INR");
    expect(body.keyId).toBe("rzp_test_key");
    expect(leadEqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({ amountPaise: 299900, currency: "INR" }));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: "order_ABC123",
        user_id: "user-1",
        product: "counselling",
        level: "senior",
        lead_id: null,
        amount_paise: 299900,
        status: "initiated",
      })
    );
  });

  it("falls back to the default (entry) level when the candidate has no fitment_leads row yet", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "rushi@example.com" } } });
    leadMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ product: "counselling" }));
    const body = await response.json();

    expect(body.amountPaise).toBe(199900); // counselling @ entry level (default)
  });

  it("returns 500 when the pending transaction insert fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "rushi@example.com" } } });
    insertMock.mockResolvedValue({ error: { message: "db error" } });
    const { POST } = await importRoute();
    const response = await POST(buildRequest({ product: "counselling" }));
    expect(response.status).toBe(500);
  });
});
