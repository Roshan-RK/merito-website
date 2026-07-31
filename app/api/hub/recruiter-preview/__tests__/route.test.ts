import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();
vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    }),
  }),
}));

const upsertMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({ from: () => ({ upsert: upsertMock }) }),
}));

async function importRoute() {
  return await import("../route");
}

describe("GET /api/hub/recruiter-preview", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    maybeSingleMock.mockReset();
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/recruiter-preview"));
    expect(response.status).toBe(401);
  });

  it("returns disabled defaults when no row exists yet", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({ data: null });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/recruiter-preview"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ enabled: false, sections: [], linkedinUrl: null });
  });

  it("returns saved settings when a row exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingleMock.mockResolvedValue({
      data: { enabled: true, sections: ["fitment", "interview"], linkedin_url: "https://www.linkedin.com/in/jane-doe" },
    });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/hub/recruiter-preview"));
    const body = await response.json();
    expect(body).toEqual({
      enabled: true,
      sections: ["fitment", "interview"],
      linkedinUrl: "https://www.linkedin.com/in/jane-doe",
    });
  });
});

describe("PUT /api/hub/recruiter-preview", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    upsertMock.mockClear();
  });

  it("returns 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { PUT } = await importRoute();
    const request = new Request("http://localhost/api/hub/recruiter-preview", {
      method: "PUT",
      body: JSON.stringify({ enabled: true, sections: ["fitment"], linkedinUrl: "https://www.linkedin.com/in/jane-doe" }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(401);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown section value", async () => {
    const { PUT } = await importRoute();
    const request = new Request("http://localhost/api/hub/recruiter-preview", {
      method: "PUT",
      body: JSON.stringify({ enabled: true, sections: ["fitment", "integrity"], linkedinUrl: "https://www.linkedin.com/in/jane-doe" }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean enabled value", async () => {
    const { PUT } = await importRoute();
    const request = new Request("http://localhost/api/hub/recruiter-preview", {
      method: "PUT",
      body: JSON.stringify({ enabled: "yes", sections: [] }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects enabled:true with no linkedinUrl", async () => {
    const { PUT } = await importRoute();
    const request = new Request("http://localhost/api/hub/recruiter-preview", {
      method: "PUT",
      body: JSON.stringify({ enabled: true, sections: ["fitment"] }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed linkedinUrl", async () => {
    const { PUT } = await importRoute();
    const request = new Request("http://localhost/api/hub/recruiter-preview", {
      method: "PUT",
      body: JSON.stringify({ enabled: true, sections: ["fitment"], linkedinUrl: "https://example.com/jane-doe" }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("accepts enabled:false with no linkedinUrl", async () => {
    const { PUT } = await importRoute();
    const request = new Request("http://localhost/api/hub/recruiter-preview", {
      method: "PUT",
      body: JSON.stringify({ enabled: false, sections: [] }),
    });
    const response = await PUT(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ enabled: false, sections: [], linkedinUrl: null });
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes a linkedinUrl with query string and trailing slash before storing", async () => {
    const { PUT } = await importRoute();
    const request = new Request("http://localhost/api/hub/recruiter-preview", {
      method: "PUT",
      body: JSON.stringify({
        enabled: true,
        sections: ["fitment"],
        linkedinUrl: "https://www.linkedin.com/in/jane-doe/?originalSubdomain=in",
      }),
    });
    const response = await PUT(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.linkedinUrl).toBe("https://www.linkedin.com/in/jane-doe");
    const [payload] = upsertMock.mock.calls[0];
    expect(payload.linkedin_url).toBe("https://www.linkedin.com/in/jane-doe");
  });

  it("upserts valid settings and echoes them back", async () => {
    const { PUT } = await importRoute();
    const request = new Request("http://localhost/api/hub/recruiter-preview", {
      method: "PUT",
      body: JSON.stringify({
        enabled: true,
        sections: ["fitment", "interview"],
        linkedinUrl: "https://www.linkedin.com/in/jane-doe",
      }),
    });
    const response = await PUT(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({
      enabled: true,
      sections: ["fitment", "interview"],
      linkedinUrl: "https://www.linkedin.com/in/jane-doe",
    });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [payload, options] = upsertMock.mock.calls[0];
    expect(payload).toMatchObject({
      user_id: "user-1",
      enabled: true,
      sections: ["fitment", "interview"],
      linkedin_url: "https://www.linkedin.com/in/jane-doe",
    });
    expect(options).toEqual({ onConflict: "user_id" });
  });
});
