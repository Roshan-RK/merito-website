import { describe, it, expect, vi, beforeEach } from "vitest";

const maybeSingleMock = vi.fn();
const fromMock = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }));
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => ({ from: fromMock }) }));

async function importRoute() {
  return await import("../route");
}

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) };
}

describe("GET /api/public/claim/[token]", () => {
  beforeEach(() => maybeSingleMock.mockReset());

  it("returns valid:false reason not_found for an unknown token", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/public/claim/bad"), makeParams("bad"));
    const body = await response.json();
    expect(body).toEqual({ valid: false, reason: "not_found" });
  });

  it("returns valid:false reason already_converted", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { candidate_name: "Jane", jd_text: "Backend Engineer role", resume_match_raw: { overallScore: 80 }, converted_lead_id: "lead-1" },
    });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/public/claim/used"), makeParams("used"));
    const body = await response.json();
    expect(body).toEqual({ valid: false, reason: "already_converted" });
  });

  it("returns the score teaser for a valid, unconverted token", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { candidate_name: "Jane", jd_text: "Backend Engineer role\nmore", resume_match_raw: { overallScore: 82 }, converted_lead_id: null },
    });
    const { GET } = await importRoute();
    const response = await GET(new Request("http://localhost/api/public/claim/good"), makeParams("good"));
    const body = await response.json();
    expect(body.valid).toBe(true);
    expect(body.candidateName).toBe("Jane");
    expect(body.roleLabel).toBe("Backend Engineer role");
    expect(body.score).toBe(8.2);
  });
});
