import { describe, it, expect, vi, beforeEach } from "vitest";

// Resolution-only coverage for the print page: which fitment_leads row it
// picks from ?lead= / ?role= and therefore which lead_id it queries the
// interview by. The JSX render path isn't exercised (async server component
// -- calling it just returns the element tree).

const getUserMock = vi.fn();

const leadsOrderMock = vi.fn();
const leadsEqMock = vi.fn().mockReturnValue({ order: leadsOrderMock });
const leadsSelectMock = vi.fn().mockReturnValue({ eq: leadsEqMock });

const interviewMaybeSingleMock = vi.fn();
const interviewLimitMock = vi.fn().mockReturnValue({ maybeSingle: interviewMaybeSingleMock });
const interviewOrderMock = vi.fn().mockReturnValue({ limit: interviewLimitMock });
const interviewEqMock = vi.fn();
interviewEqMock.mockReturnValue({ eq: interviewEqMock, order: interviewOrderMock });
const interviewSelectMock = vi.fn().mockReturnValue({ eq: interviewEqMock });

const fromMock = vi.fn((table: string) => {
  if (table === "fitment_leads") return { select: leadsSelectMock };
  if (table === "fitment_interviews") return { select: interviewSelectMock };
  throw new Error(`Unexpected table ${table}`);
});

vi.mock("@/lib/supabaseAuthServer", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));
vi.mock("next/font/google", () => ({ Manrope: () => ({ variable: "manrope-var", className: "manrope" }) }));
vi.mock("next/image", () => ({ __esModule: true, default: () => null }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/intervuebox/reports", () => ({ getCandidateResumeDetails: vi.fn().mockResolvedValue(null) }));

async function importPage() {
  return await import("../page");
}

const LEADS = [
  { id: "lead-pm", role_title: "Product Manager", name: "PM", ib_applied_job_id: null },
  { id: "lead-eng", role_title: "Engineer", name: "Eng", ib_applied_job_id: null },
  { id: "lead-design", role_title: "Designer", name: "Des", ib_applied_job_id: null },
];

describe("InterviewPrintPage lead/role resolution", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    leadsOrderMock.mockReset();
    interviewMaybeSingleMock.mockReset();
    interviewEqMock.mockClear();

    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "candidate@example.com" } } });
    leadsOrderMock.mockResolvedValue({ data: LEADS, error: null });
    interviewMaybeSingleMock.mockResolvedValue({
      data: {
        role_title: "Designer",
        status: "ready",
        report_raw: { overallScore: 50 },
        updated_at: "2026-08-01T00:00:00Z",
        lead_id: "lead-design",
      },
      error: null,
    });
  });

  it("resolves the interview by ?lead= when present", async () => {
    const { default: Page } = await importPage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (Page as any)({ searchParams: Promise.resolve({ lead: "lead-eng" }) });
    expect(interviewEqMock).toHaveBeenCalledWith("lead_id", "lead-eng");
  });

  it("falls back to a ?role= text match when ?lead= is absent (back-compat)", async () => {
    const { default: Page } = await importPage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (Page as any)({ searchParams: Promise.resolve({ role: "Designer" }) });
    expect(interviewEqMock).toHaveBeenCalledWith("lead_id", "lead-design");
  });

  it("prefers ?lead= over ?role= when both are present", async () => {
    const { default: Page } = await importPage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (Page as any)({ searchParams: Promise.resolve({ lead: "lead-eng", role: "Designer" }) });
    expect(interviewEqMock).toHaveBeenCalledWith("lead_id", "lead-eng");
    expect(interviewEqMock).not.toHaveBeenCalledWith("lead_id", "lead-design");
  });

  it("uses the newest lead when neither param is present", async () => {
    const { default: Page } = await importPage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (Page as any)({ searchParams: Promise.resolve({}) });
    expect(interviewEqMock).toHaveBeenCalledWith("lead_id", "lead-pm");
  });
});
