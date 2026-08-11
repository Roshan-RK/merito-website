import { describe, it, expect, vi, beforeEach } from "vitest";

function makeQueryStub(result: { data: unknown }) {
  const stub: Record<string, unknown> = {};
  stub.select = () => stub;
  stub.eq = () => stub;
  stub.order = () => stub;
  stub.limit = () => stub;
  stub.maybeSingle = async () => result;
  stub.then = (resolve: (value: typeof result) => void) => resolve(result);
  return stub;
}

let tableResults: Record<string, ReturnType<typeof makeQueryStub>>;
const fromMock = vi.fn((table: string) => tableResults[table]);
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}));

const upsertContactDetailRequestMock = vi.fn();
vi.mock("@/lib/contactDetailRequests", () => ({
  upsertContactDetailRequest: upsertContactDetailRequestMock,
}));

const sendRecruiterViewedEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/recruiterViewEmails", () => ({
  sendRecruiterViewedEmail: sendRecruiterViewedEmailMock,
}));

async function importRoute() {
  return await import("../route");
}

function request(body: unknown, key = "test-key") {
  return new Request("http://localhost/api/public/recruiter-preview/request-details", {
    method: "POST",
    headers: key ? { "x-merito-extension-key": key } : {},
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/recruiter-preview/request-details", () => {
  beforeEach(() => {
    vi.stubEnv("RECRUITER_EXTENSION_KEY", "test-key");
    tableResults = {
      recruiter_preview_settings: makeQueryStub({ data: null }),
      fitment_leads: makeQueryStub({ data: [] }),
    };
    fromMock.mockClear();
    upsertContactDetailRequestMock.mockReset();
    sendRecruiterViewedEmailMock.mockClear();
  });

  it("returns 401 when the key header is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }, ""));
    expect(response.status).toBe(401);
  });

  it("returns 404 on a malformed linkedinUrl", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "not-a-url" }));
    expect(response.status).toBe(404);
  });

  it("returns 404 when no enabled candidate matches", async () => {
    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/nobody" }));
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Not found." });
    expect(upsertContactDetailRequestMock).not.toHaveBeenCalled();
  });

  it("creates a new request, sends the email, and returns pending", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({ data: [{ role_title: "Backend Engineer", name: "Jane Doe", email: "jane@example.com" }] });
    upsertContactDetailRequestMock.mockResolvedValue({ status: "pending", isNewOrReset: true });

    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "pending" });
    expect(upsertContactDetailRequestMock).toHaveBeenCalledWith("user-1", "https://www.linkedin.com/in/jane-doe", "Backend Engineer");
    expect(sendRecruiterViewedEmailMock).toHaveBeenCalledWith("jane@example.com", "Jane Doe");
  });

  it("does not resend the email when the request already existed (no-op)", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({ data: [{ role_title: "Backend Engineer", name: "Jane Doe", email: "jane@example.com" }] });
    upsertContactDetailRequestMock.mockResolvedValue({ status: "pending", isNewOrReset: false });

    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    const body = await response.json();

    expect(body).toEqual({ status: "pending" });
    expect(sendRecruiterViewedEmailMock).not.toHaveBeenCalled();
  });

  it("returns the approved status without resending an email", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({ data: [{ role_title: "Backend Engineer", name: "Jane Doe", email: "jane@example.com" }] });
    upsertContactDetailRequestMock.mockResolvedValue({ status: "approved", isNewOrReset: false });

    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    const body = await response.json();

    expect(body).toEqual({ status: "approved" });
    expect(sendRecruiterViewedEmailMock).not.toHaveBeenCalled();
  });
});
