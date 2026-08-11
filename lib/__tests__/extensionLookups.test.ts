import { describe, it, expect, vi, beforeEach } from "vitest";

function makeQueryStub(result: { data: unknown }) {
  const stub: Record<string, unknown> = {};
  stub.select = () => stub;
  stub.eq = () => stub;
  stub.order = () => stub;
  stub.limit = () => stub;
  stub.insert = insertMock;
  stub.then = (resolve: (value: typeof result) => void) => resolve(result);
  return stub;
}

let tableResults: Record<string, ReturnType<typeof makeQueryStub>>;
const insertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn((table: string) => tableResults[table]);
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

const sendRecruiterViewedEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/recruiterViewEmails", () => ({
  sendRecruiterViewedEmail: sendRecruiterViewedEmailMock,
}));

async function importModule() {
  return await import("../extensionLookups");
}

describe("recordLookup", () => {
  beforeEach(() => {
    tableResults = {
      extension_lookups: makeQueryStub({ data: [] }),
      fitment_leads: makeQueryStub({ data: [{ email: "jane@example.com", name: "Jane Doe" }] }),
    };
    fromMock.mockClear();
    insertMock.mockClear().mockResolvedValue({ error: null });
    sendRecruiterViewedEmailMock.mockClear();
  });

  it("does not query for a prior view or send an email when there is no match", async () => {
    const { recordLookup } = await importModule();
    await recordLookup({ linkedinUrl: "https://www.linkedin.com/in/nobody", matchedUserId: null });
    expect(insertMock).toHaveBeenCalledWith({ linkedin_url: "https://www.linkedin.com/in/nobody", matched_user_id: null });
    expect(sendRecruiterViewedEmailMock).not.toHaveBeenCalled();
  });

  it("sends the view email when there is no prior lookup for this candidate", async () => {
    tableResults.extension_lookups = makeQueryStub({ data: [{ created_at: new Date().toISOString() }] });
    const { recordLookup } = await importModule();
    await recordLookup({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", matchedUserId: "user-1" });
    expect(sendRecruiterViewedEmailMock).toHaveBeenCalledWith("jane@example.com", "Jane Doe");
  });

  it("sends the view email when the prior lookup is older than 24h", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    tableResults.extension_lookups = makeQueryStub({
      data: [{ created_at: new Date().toISOString() }, { created_at: twoDaysAgo }],
    });
    const { recordLookup } = await importModule();
    await recordLookup({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", matchedUserId: "user-1" });
    expect(sendRecruiterViewedEmailMock).toHaveBeenCalled();
  });

  it("skips the view email when the prior lookup is within 24h", async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    tableResults.extension_lookups = makeQueryStub({
      data: [{ created_at: new Date().toISOString() }, { created_at: oneHourAgo }],
    });
    const { recordLookup } = await importModule();
    await recordLookup({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", matchedUserId: "user-1" });
    expect(sendRecruiterViewedEmailMock).not.toHaveBeenCalled();
  });

  it("does not throw when there is no lead email on file", async () => {
    tableResults.extension_lookups = makeQueryStub({ data: [{ created_at: new Date().toISOString() }] });
    tableResults.fitment_leads = makeQueryStub({ data: [] });
    const { recordLookup } = await importModule();
    await expect(recordLookup({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", matchedUserId: "user-1" })).resolves.toBeUndefined();
    expect(sendRecruiterViewedEmailMock).not.toHaveBeenCalled();
  });
});
