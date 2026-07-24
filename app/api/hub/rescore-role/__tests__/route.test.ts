import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const getUserMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: sessionFromMock,
  }),
}));

const maybeSingleMock = vi.fn();
const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
const notMock = vi.fn().mockReturnValue({ order: orderMock });
const eqMock = vi.fn().mockReturnValue({ not: notMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
const sessionFromMock = vi.fn(() => ({ select: selectMock }));

const claimFitmentLeadsMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/claimFitmentLeads", () => ({ claimFitmentLeads: claimFitmentLeadsMock }));

const originalFetch = global.fetch;
const fetchMock = vi.fn();

async function importRoute() {
  return await import("../route");
}

function buildForm() {
  const form = new FormData();
  form.set("role", "Senior Product Manager");
  form.set("jdText", "Updated JD text.");
  form.set("candidateLevel", "mid");
  form.set("cv", new Blob(["cv bytes"], { type: "application/pdf" }), "resume.pdf");
  return form;
}

describe("POST /api/hub/rescore-role", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    maybeSingleMock.mockReset();
    claimFitmentLeadsMock.mockClear();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("overrides the client-submitted candidateLevel with the existing lead's stored value", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "user@example.com" } } });
    maybeSingleMock.mockResolvedValue({ data: { phone: "+919876543210", candidate_level: "senior" }, error: null });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "ready", score: 8 }), { status: 200 }));

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/rescore-role", {
      method: "POST",
      body: buildForm(),
    });
    await POST(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const forwardedBody = fetchMock.mock.calls[0][1].body as FormData;
    expect(forwardedBody.get("candidateLevel")).toBe("senior");
  });

  it("leaves the client-submitted candidateLevel untouched when no existing lead is found", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "user@example.com" } } });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "ready", score: 8 }), { status: 200 }));

    const { POST } = await importRoute();
    const request = new Request("http://localhost/api/hub/rescore-role", {
      method: "POST",
      body: buildForm(),
    });
    await POST(request);

    const forwardedBody = fetchMock.mock.calls[0][1].body as FormData;
    expect(forwardedBody.get("candidateLevel")).toBe("mid");
  });
});
