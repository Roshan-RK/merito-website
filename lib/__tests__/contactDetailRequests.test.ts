import { describe, it, expect, vi, beforeEach } from "vitest";

function makeQueryStub(result: { data: unknown }) {
  const stub: Record<string, unknown> = {};
  stub.select = () => stub;
  stub.eq = () => stub;
  stub.order = () => stub;
  stub.limit = () => stub;
  stub.maybeSingle = async () => result;
  stub.then = (resolve: (value: typeof result) => void) => resolve(result);
  stub.insert = insertMock;
  stub.update = () => ({ eq: updateEqMock });
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

describe("logAndGetContactEmail", () => {
  beforeEach(() => {
    tableResults = {
      fitment_leads: makeQueryStub({ data: [] }),
      contact_detail_requests: makeQueryStub({ data: null }),
    };
    fromMock.mockClear();
    insertMock.mockClear().mockResolvedValue({ error: null });
    updateEqMock.mockClear().mockResolvedValue({ error: null });
  });

  it("returns null when there is no lead email on file", async () => {
    const { logAndGetContactEmail } = await importModule();
    const result = await logAndGetContactEmail("user-1", "https://www.linkedin.com/in/jane-doe", "Backend Engineer");
    expect(result).toBeNull();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts a new log row and returns the email when none exists yet", async () => {
    tableResults.fitment_leads = makeQueryStub({ data: [{ email: "jane@example.com" }] });
    const { logAndGetContactEmail } = await importModule();
    const result = await logAndGetContactEmail("user-1", "https://www.linkedin.com/in/jane-doe", "Backend Engineer");
    expect(result).toBe("jane@example.com");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", linkedin_url: "https://www.linkedin.com/in/jane-doe", status: "approved" })
    );
  });

  it("updates the existing log row and returns the email on a repeat reveal", async () => {
    tableResults.fitment_leads = makeQueryStub({ data: [{ email: "jane@example.com" }] });
    tableResults.contact_detail_requests = makeQueryStub({ data: { id: "req-1" } });
    const { logAndGetContactEmail } = await importModule();
    const result = await logAndGetContactEmail("user-1", "https://www.linkedin.com/in/jane-doe", "Backend Engineer");
    expect(result).toBe("jane@example.com");
    expect(updateEqMock).toHaveBeenCalledWith("id", "req-1");
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("listContactDetailRequests", () => {
  beforeEach(() => {
    fromMock.mockClear();
  });

  it("returns mapped rows joined with candidate email, and pagination metadata", async () => {
    fromMock
      .mockImplementationOnce(() => ({ select: () => Promise.resolve({ count: 25, error: null }) }))
      .mockImplementationOnce(() => ({
        select: () => ({
          order: () => ({
            range: () =>
              Promise.resolve({
                data: [
                  {
                    id: "req-1",
                    user_id: "user-1",
                    linkedin_url: "https://linkedin.com/in/x",
                    role_title: "PM",
                    status: "approved",
                    requested_at: "2026-08-20T10:00:00.000Z",
                    decided_by: "auto",
                  },
                ],
                error: null,
              }),
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        select: () => ({ in: () => Promise.resolve({ data: [{ user_id: "user-1", email: "jane@example.com" }] }) }),
      }));

    const { listContactDetailRequests } = await importModule();
    const result = await listContactDetailRequests(2);

    expect(result).toEqual({
      rows: [
        {
          id: "req-1",
          userId: "user-1",
          candidateEmail: "jane@example.com",
          linkedinUrl: "https://linkedin.com/in/x",
          roleTitle: "PM",
          status: "approved",
          requestedAt: "2026-08-20T10:00:00.000Z",
          decidedBy: "auto",
        },
      ],
      total: 25,
      totalPages: 2,
      page: 2,
    });
  });

  it("skips the email lookup and returns an empty page when there are no rows", async () => {
    fromMock
      .mockImplementationOnce(() => ({ select: () => Promise.resolve({ count: 0, error: null }) }))
      .mockImplementationOnce(() => ({
        select: () => ({ order: () => ({ range: () => Promise.resolve({ data: [], error: null }) }) }),
      }));

    const { listContactDetailRequests } = await importModule();
    const result = await listContactDetailRequests();

    expect(result).toEqual({ rows: [], total: 0, totalPages: 1, page: 1 });
    expect(fromMock).toHaveBeenCalledTimes(2);
  });
});
