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

const logAndGetContactEmailMock = vi.fn();
vi.mock("@/lib/contactDetailRequests", () => ({
  logAndGetContactEmail: logAndGetContactEmailMock,
}));

const sendRecruiterViewedEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/recruiterViewEmails", () => ({
  sendRecruiterViewedEmail: sendRecruiterViewedEmailMock,
}));

const isRecruiterEmailVerifiedMock = vi.fn();
vi.mock("@/lib/recruiterIdentity", () => ({
  isRecruiterEmailVerified: isRecruiterEmailVerifiedMock,
}));

async function importRoute() {
  return await import("../route");
}

function request(body: Record<string, unknown>, key = "test-key") {
  return new Request("http://localhost/api/public/recruiter-preview/request-details", {
    method: "POST",
    headers: key ? { "x-merito-extension-key": key } : {},
    body: JSON.stringify({ recruiterEmail: "recruiter@example.com", ...body }),
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
    logAndGetContactEmailMock.mockReset();
    sendRecruiterViewedEmailMock.mockClear();
    isRecruiterEmailVerifiedMock.mockReset();
    isRecruiterEmailVerifiedMock.mockResolvedValue(true);
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
    expect(logAndGetContactEmailMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the candidate has no email on file", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({ data: [{ role_title: "Backend Engineer", name: "Jane Doe" }] });
    logAndGetContactEmailMock.mockResolvedValue(null);

    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    expect(response.status).toBe(404);
    expect(sendRecruiterViewedEmailMock).not.toHaveBeenCalled();
  });

  it("reveals the email and notifies the candidate on every call", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({ data: [{ role_title: "Backend Engineer", name: "Jane Doe" }] });
    logAndGetContactEmailMock.mockResolvedValue("jane@example.com");

    const { POST } = await importRoute();
    const response = await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ email: "jane@example.com" });
    expect(logAndGetContactEmailMock).toHaveBeenCalledWith("user-1", "https://www.linkedin.com/in/jane-doe", "Backend Engineer");
    expect(sendRecruiterViewedEmailMock).toHaveBeenCalledWith("jane@example.com", "Jane Doe");
  });

  it("uses the lead matching the given leadId when present", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({
      data: [
        { id: "lead-2", role_title: "Software Engineer", name: "Jane Doe" },
        { id: "lead-1", role_title: "Data Analyst", name: "Jane Doe" },
      ],
    });
    logAndGetContactEmailMock.mockResolvedValue("jane@example.com");

    const { POST } = await importRoute();
    await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", leadId: "lead-1" }));

    expect(logAndGetContactEmailMock).toHaveBeenCalledWith("user-1", "https://www.linkedin.com/in/jane-doe", "Data Analyst");
  });

  it("falls back to the most recent lead when leadId doesn't belong to this candidate", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({
      data: [{ id: "lead-2", role_title: "Software Engineer", name: "Jane Doe" }],
    });
    logAndGetContactEmailMock.mockResolvedValue("jane@example.com");

    const { POST } = await importRoute();
    await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", leadId: "someone-elses-lead" }));

    expect(logAndGetContactEmailMock).toHaveBeenCalledWith("user-1", "https://www.linkedin.com/in/jane-doe", "Software Engineer");
  });

  it("notifies again on a second reveal for the same candidate (not deduped)", async () => {
    tableResults.recruiter_preview_settings = makeQueryStub({ data: { user_id: "user-1" } });
    tableResults.fitment_leads = makeQueryStub({ data: [{ role_title: "Backend Engineer", name: "Jane Doe" }] });
    logAndGetContactEmailMock.mockResolvedValue("jane@example.com");

    const { POST } = await importRoute();
    await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));
    await POST(request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe" }));

    expect(sendRecruiterViewedEmailMock).toHaveBeenCalledTimes(2);
  });

  it("returns 403 when recruiterEmail is missing", async () => {
    const { POST } = await importRoute();
    const response = await POST(
      request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", recruiterEmail: undefined })
    );
    expect(response.status).toBe(403);
    expect(logAndGetContactEmailMock).not.toHaveBeenCalled();
  });

  it("returns 403 when recruiterEmail is not verified", async () => {
    isRecruiterEmailVerifiedMock.mockResolvedValue(false);
    const { POST } = await importRoute();
    const response = await POST(
      request({ linkedinUrl: "https://www.linkedin.com/in/jane-doe", recruiterEmail: "unverified@example.com" })
    );
    expect(response.status).toBe(403);
    expect(logAndGetContactEmailMock).not.toHaveBeenCalled();
    expect(sendRecruiterViewedEmailMock).not.toHaveBeenCalled();
  });
});
