import { describe, it, expect, vi, beforeEach } from "vitest";

function makeQueryStub(result: { data: unknown }) {
  const stub: Record<string, unknown> = {};
  stub.select = () => stub;
  stub.eq = () => stub;
  stub.order = () => stub;
  stub.limit = () => stub;
  stub.maybeSingle = async () => result;
  stub.insert = insertMock;
  stub.update = () => ({ eq: updateEqMock });
  stub.then = (resolve: (value: typeof result) => void) => resolve(result);
  return stub;
}

let tableResults: Record<string, ReturnType<typeof makeQueryStub>>;
const insertMock = vi.fn().mockResolvedValue({ error: null });
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn((table: string) => tableResults[table]);

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

async function importModule() {
  return await import("../contactDetailRequests");
}

describe("upsertContactDetailRequest", () => {
  beforeEach(() => {
    tableResults = { contact_detail_requests: makeQueryStub({ data: null }) };
    fromMock.mockClear();
    insertMock.mockClear().mockResolvedValue({ error: null });
    updateEqMock.mockClear().mockResolvedValue({ error: null });
  });

  it("inserts a new pending row when none exists", async () => {
    const { upsertContactDetailRequest } = await importModule();
    const result = await upsertContactDetailRequest("user-1", "https://www.linkedin.com/in/jane-doe", "Backend Engineer");
    expect(result).toEqual({ status: "pending", isNewOrReset: true });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", linkedin_url: "https://www.linkedin.com/in/jane-doe", role_title: "Backend Engineer", status: "pending" })
    );
  });

  it("is a no-op returning the existing status when already pending", async () => {
    tableResults.contact_detail_requests = makeQueryStub({ data: { id: "req-1", status: "pending" } });
    const { upsertContactDetailRequest } = await importModule();
    const result = await upsertContactDetailRequest("user-1", "https://www.linkedin.com/in/jane-doe", null);
    expect(result).toEqual({ status: "pending", isNewOrReset: false });
    expect(insertMock).not.toHaveBeenCalled();
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("is a no-op returning the existing status when already approved", async () => {
    tableResults.contact_detail_requests = makeQueryStub({ data: { id: "req-1", status: "approved" } });
    const { upsertContactDetailRequest } = await importModule();
    const result = await upsertContactDetailRequest("user-1", "https://www.linkedin.com/in/jane-doe", null);
    expect(result).toEqual({ status: "approved", isNewOrReset: false });
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("resets a denied row back to pending", async () => {
    tableResults.contact_detail_requests = makeQueryStub({ data: { id: "req-1", status: "denied" } });
    const { upsertContactDetailRequest } = await importModule();
    const result = await upsertContactDetailRequest("user-1", "https://www.linkedin.com/in/jane-doe", "Backend Engineer");
    expect(result).toEqual({ status: "pending", isNewOrReset: true });
    expect(updateEqMock).toHaveBeenCalledWith("id", "req-1");
  });
});

describe("getApprovedContactDetails", () => {
  beforeEach(() => {
    tableResults = {
      contact_detail_requests: makeQueryStub({ data: null }),
      fitment_leads: makeQueryStub({ data: [] }),
    };
    fromMock.mockClear();
  });

  it("returns null when there is no approved request", async () => {
    const { getApprovedContactDetails } = await importModule();
    expect(await getApprovedContactDetails("user-1")).toBeNull();
  });

  it("returns email/phone from the latest fitment_leads row when approved", async () => {
    tableResults.contact_detail_requests = makeQueryStub({ data: { status: "approved" } });
    tableResults.fitment_leads = makeQueryStub({ data: [{ email: "jane@example.com", phone: "9999999999" }] });
    const { getApprovedContactDetails } = await importModule();
    expect(await getApprovedContactDetails("user-1")).toEqual({ email: "jane@example.com", phone: "9999999999" });
  });

  it("falls back to 'Not specified' when phone is missing", async () => {
    tableResults.contact_detail_requests = makeQueryStub({ data: { status: "approved" } });
    tableResults.fitment_leads = makeQueryStub({ data: [{ email: "jane@example.com", phone: null }] });
    const { getApprovedContactDetails } = await importModule();
    expect(await getApprovedContactDetails("user-1")).toEqual({ email: "jane@example.com", phone: "Not specified" });
  });

  it("returns null when approved but there is no lead email on file", async () => {
    tableResults.contact_detail_requests = makeQueryStub({ data: { status: "approved" } });
    tableResults.fitment_leads = makeQueryStub({ data: [] });
    const { getApprovedContactDetails } = await importModule();
    expect(await getApprovedContactDetails("user-1")).toBeNull();
  });
});
