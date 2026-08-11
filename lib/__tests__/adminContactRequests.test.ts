import { describe, it, expect, vi, beforeEach } from "vitest";

function makeQueryStub(result: { data: unknown }) {
  const stub: Record<string, unknown> = {};
  stub.select = () => stub;
  stub.eq = () => stub;
  stub.in = () => stub;
  stub.order = () => stub;
  stub.maybeSingle = async () => result;
  stub.then = (resolve: (value: typeof result) => void) => resolve(result);
  stub.update = () => ({ eq: updateEqMock });
  return stub;
}

let tableResults: Record<string, ReturnType<typeof makeQueryStub>>;
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn((table: string) => tableResults[table]);
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importModule() {
  return await import("../adminContactRequests");
}

describe("ALLOWED_TRANSITIONS", () => {
  it("allows pending to move to approved or denied, and either to flip to the other", async () => {
    const { ALLOWED_TRANSITIONS } = await importModule();
    expect(ALLOWED_TRANSITIONS.pending).toEqual(["approved", "denied"]);
    expect(ALLOWED_TRANSITIONS.approved).toEqual(["denied"]);
    expect(ALLOWED_TRANSITIONS.denied).toEqual(["approved"]);
  });
});

describe("listContactRequests", () => {
  beforeEach(() => {
    tableResults = {
      contact_detail_requests: makeQueryStub({
        data: [{ id: "req-1", user_id: "user-1", linkedin_url: "https://www.linkedin.com/in/jane-doe", role_title: "Backend Engineer", status: "pending", requested_at: "2026-08-11T00:00:00.000Z", decided_at: null, decided_by: null }],
      }),
      fitment_leads: makeQueryStub({ data: [{ user_id: "user-1", email: "jane@example.com" }] }),
    };
    fromMock.mockClear();
  });

  it("returns rows with the candidate's email joined in", async () => {
    const { listContactRequests } = await importModule();
    const rows = await listContactRequests();
    expect(rows).toEqual([
      {
        id: "req-1",
        userId: "user-1",
        email: "jane@example.com",
        linkedinUrl: "https://www.linkedin.com/in/jane-doe",
        roleTitle: "Backend Engineer",
        status: "pending",
        requestedAt: "2026-08-11T00:00:00.000Z",
        decidedAt: null,
        decidedBy: null,
      },
    ]);
  });
});

describe("getContactRequest", () => {
  beforeEach(() => {
    tableResults = {
      contact_detail_requests: makeQueryStub({
        data: { id: "req-1", user_id: "user-1", linkedin_url: "https://www.linkedin.com/in/jane-doe", role_title: null, status: "pending", requested_at: "2026-08-11T00:00:00.000Z", decided_at: null, decided_by: null },
      }),
      fitment_leads: makeQueryStub({ data: [{ user_id: "user-1", email: "jane@example.com" }] }),
    };
    fromMock.mockClear();
  });

  it("returns null when not found", async () => {
    tableResults.contact_detail_requests = makeQueryStub({ data: null });
    const { getContactRequest } = await importModule();
    expect(await getContactRequest("missing")).toBeNull();
  });

  it("returns the row with the candidate's email joined in", async () => {
    const { getContactRequest } = await importModule();
    const row = await getContactRequest("req-1");
    expect(row?.email).toBe("jane@example.com");
    expect(row?.status).toBe("pending");
  });
});

describe("updateContactRequestStatus", () => {
  beforeEach(() => {
    tableResults = { contact_detail_requests: makeQueryStub({ data: null }) };
    fromMock.mockClear();
    updateEqMock.mockClear().mockResolvedValue({ error: null });
  });

  it("updates status, decided_at, and decided_by", async () => {
    const { updateContactRequestStatus } = await importModule();
    await updateContactRequestStatus("req-1", "approved", "admin@merito.ai");
    expect(updateEqMock).toHaveBeenCalledWith("id", "req-1");
  });
});
