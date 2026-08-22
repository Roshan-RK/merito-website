import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchAllCandidatesMock = vi.fn();
vi.mock("@/lib/adminCandidates", async () => {
  const actual = await vi.importActual<typeof import("../adminCandidates")>("../adminCandidates");
  return { ...actual, fetchAllCandidates: fetchAllCandidatesMock };
});

const razorpayTransactionsSelectMock = vi.fn();
const razorpayTransactionsEqMock = vi.fn();
const fitmentLeadsSelectMock = vi.fn();
const fitmentLeadsEqMock = vi.fn();
const fitmentInterviewsSelectMock = vi.fn();
const fitmentInterviewsEqMock = vi.fn();
const extensionLookupsSelectMock = vi.fn();
const recruiterPreviewSettingsSelectMock = vi.fn();
const recruiterPreviewSettingsEqMock = vi.fn();
const contactDetailRequestsSelectMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: (table: string) => {
      if (table === "razorpay_transactions") return { select: razorpayTransactionsSelectMock };
      if (table === "fitment_leads") return { select: fitmentLeadsSelectMock };
      if (table === "fitment_interviews") return { select: fitmentInterviewsSelectMock };
      if (table === "extension_lookups") return { select: extensionLookupsSelectMock };
      if (table === "recruiter_preview_settings") return { select: recruiterPreviewSettingsSelectMock };
      if (table === "contact_detail_requests") return { select: contactDetailRequestsSelectMock };
      throw new Error(`Unexpected table in test: ${table}`);
    },
  }),
}));

function candidate(userId: string, roleTitle: string, funnelStage: string) {
  return { userId, email: `${userId}@example.com`, name: userId, latestRoleTitle: roleTitle, firstSeenAt: "2026-01-01", funnelStage };
}

describe("getFunnelDropoff", () => {
  beforeEach(() => fetchAllCandidatesMock.mockReset());

  it("computes reached-or-further counts and percentages relative to start and previous stage", async () => {
    fetchAllCandidatesMock.mockResolvedValue([
      candidate("u1", "SDE", "fitment_started"),
      candidate("u2", "SDE", "report_unlocked"),
      candidate("u3", "SDE", "interview_ready"),
      candidate("u4", "SDE", "interview_ready"),
    ]);

    const { getFunnelDropoff } = await import("../adminAnalytics");
    const rows = await getFunnelDropoff();

    expect(rows[0]).toMatchObject({ stage: "fitment_started", count: 4, pctOfStart: 100, pctOfPrevious: null });
    expect(rows[1]).toMatchObject({ stage: "report_unlocked", count: 3, pctOfStart: 75 });
    expect(rows[2]).toMatchObject({ stage: "interview_ready", count: 2, pctOfPrevious: expect.closeTo(66.7, 1) });
    expect(rows[3]).toMatchObject({ stage: "personality_completed", count: 0, pctOfPrevious: 0 });
  });

  it("returns all-zero rows without dividing by zero when there are no candidates", async () => {
    fetchAllCandidatesMock.mockResolvedValue([]);

    const { getFunnelDropoff } = await import("../adminAnalytics");
    const rows = await getFunnelDropoff();

    expect(rows.every((r) => r.count === 0 && r.pctOfStart === 0)).toBe(true);
  });
});

describe("getRoleTitleBreakdown", () => {
  beforeEach(() => fetchAllCandidatesMock.mockReset());

  it("groups by role and counts each stage as reached-or-further within that role", async () => {
    fetchAllCandidatesMock.mockResolvedValue([
      candidate("u1", "SDE", "interview_ready"),
      candidate("u2", "SDE", "fitment_started"),
      candidate("u3", "PM", "report_unlocked"),
    ]);

    const { getRoleTitleBreakdown } = await import("../adminAnalytics");
    const rows = await getRoleTitleBreakdown();

    const sde = rows.find((r) => r.roleTitle === "SDE")!;
    expect(sde.total).toBe(2);
    expect(sde.fitment_started).toBe(2);
    expect(sde.interview_ready).toBe(1);
    expect(sde.reference_completed).toBe(0);

    const pm = rows.find((r) => r.roleTitle === "PM")!;
    expect(pm.total).toBe(1);
    expect(pm.report_unlocked).toBe(1);
  });
});

describe("getRevenueBreakdown", () => {
  beforeEach(() => {
    razorpayTransactionsSelectMock.mockReset();
    razorpayTransactionsEqMock.mockReset();
    razorpayTransactionsSelectMock.mockReturnValue({ eq: razorpayTransactionsEqMock });
    fitmentLeadsSelectMock.mockReset();
  });

  it("sums successful transactions and groups by product and role, excluding non-success rows via the query filter", async () => {
    razorpayTransactionsEqMock.mockResolvedValue({
      data: [
        { product: "report", lead_id: "lead-1", amount_paise: 10000, created_at: "2020-01-01T00:00:00Z" },
        { product: "report", lead_id: "lead-1", amount_paise: 5000, created_at: "2020-01-02T00:00:00Z" },
        { product: "bundle", lead_id: null, amount_paise: 20000, created_at: "2020-01-03T00:00:00Z" },
      ],
    });
    fitmentLeadsSelectMock.mockResolvedValue({ data: [{ id: "lead-1", role_title: "SDE" }] });

    const { getRevenueBreakdown } = await import("../adminAnalytics");
    const result = await getRevenueBreakdown();

    expect(razorpayTransactionsEqMock).toHaveBeenCalledWith("status", "success");
    expect(result.totalPaise).toBe(35000);
    expect(result.byProduct).toEqual([
      { product: "bundle", amountPaise: 20000, count: 1 },
      { product: "report", amountPaise: 15000, count: 2 },
    ]);
    expect(result.byRoleTitle).toEqual([
      { roleTitle: "Not role-linked", amountPaise: 20000, count: 1 },
      { roleTitle: "SDE", amountPaise: 15000, count: 2 },
    ]);
  });
});

describe("getDataQualityStats", () => {
  beforeEach(() => {
    fitmentInterviewsSelectMock.mockReset();
    fitmentInterviewsEqMock.mockReset();
    fitmentInterviewsSelectMock.mockReturnValue({ eq: fitmentInterviewsEqMock });
    fitmentLeadsSelectMock.mockReset();
    fitmentLeadsEqMock.mockReset();
    fitmentLeadsSelectMock.mockReturnValue({ eq: fitmentLeadsEqMock });
  });

  it("counts ready interviews with an empty skillReport and ready fitment leads missing resume text/categories", async () => {
    fitmentInterviewsEqMock.mockResolvedValue({
      data: [{ report_raw: { skillReport: {} } }, { report_raw: { skillReport: { comms: { score: 7, comment: "ok" } } } }],
    });
    fitmentLeadsEqMock.mockResolvedValue({
      data: [
        { resume_text: "", resume_match_raw: { categories: [] } },
        { resume_text: "some resume", resume_match_raw: { categories: [{ key: "skills" }] } },
      ],
    });

    const { getDataQualityStats } = await import("../adminAnalytics");
    const stats = await getDataQualityStats();

    expect(stats).toEqual({
      interviewsReady: 2,
      interviewsMissingSkillReport: 1,
      fitmentReady: 2,
      fitmentMissingResumeText: 1,
      fitmentMissingCategories: 1,
    });
  });
});

describe("getWeeklyTrends", () => {
  beforeEach(() => {
    fetchAllCandidatesMock.mockReset();
    razorpayTransactionsSelectMock.mockReset();
    razorpayTransactionsEqMock.mockReset();
    razorpayTransactionsSelectMock.mockReturnValue({ eq: razorpayTransactionsEqMock });
  });

  it("buckets signups and revenue into Monday-anchored weeks, zero-filling weeks with no activity", async () => {
    const thisMonday = new Date();
    const day = thisMonday.getUTCDay();
    thisMonday.setUTCDate(thisMonday.getUTCDate() - (day === 0 ? 6 : day - 1));
    thisMonday.setUTCHours(0, 0, 0, 0);
    const midWeek = new Date(thisMonday);
    midWeek.setUTCDate(midWeek.getUTCDate() + 2);

    fetchAllCandidatesMock.mockResolvedValue([candidate("u1", "SDE", "fitment_started")].map((c) => ({ ...c, firstSeenAt: midWeek.toISOString() })));
    razorpayTransactionsEqMock.mockResolvedValue({ data: [{ amount_paise: 5000, created_at: midWeek.toISOString() }] });

    const { getWeeklyTrends } = await import("../adminAnalytics");
    const weeks = await getWeeklyTrends(3);

    expect(weeks).toHaveLength(3);
    expect(weeks[2]).toEqual({ weekStart: thisMonday.toISOString().slice(0, 10), newCandidates: 1, revenuePaise: 5000 });
    expect(weeks[0]).toMatchObject({ newCandidates: 0, revenuePaise: 0 });
    expect(weeks[1]).toMatchObject({ newCandidates: 0, revenuePaise: 0 });
  });
});

describe("getRecruiterEngagementFunnel", () => {
  beforeEach(() => {
    extensionLookupsSelectMock.mockReset();
    recruiterPreviewSettingsSelectMock.mockReset();
    recruiterPreviewSettingsEqMock.mockReset();
    recruiterPreviewSettingsSelectMock.mockReturnValue({ eq: recruiterPreviewSettingsEqMock });
    contactDetailRequestsSelectMock.mockReset();
  });

  it("intersects matched candidates against preview-enabled and contact-revealed sets", async () => {
    extensionLookupsSelectMock
      .mockReturnValueOnce(Promise.resolve({ count: 42 }))
      .mockReturnValueOnce({ not: () => Promise.resolve({ data: [{ matched_user_id: "u1" }, { matched_user_id: "u2" }, { matched_user_id: "u2" }] }) });
    recruiterPreviewSettingsEqMock.mockResolvedValue({ data: [{ user_id: "u1" }, { user_id: "u3" }] });
    contactDetailRequestsSelectMock.mockResolvedValue({ data: [{ user_id: "u2" }] });

    const { getRecruiterEngagementFunnel } = await import("../adminAnalytics");
    const result = await getRecruiterEngagementFunnel();

    expect(result).toEqual({
      totalLookups: 42,
      matchedCandidates: 2, // u1, u2 (u2 deduped despite 2 lookup rows)
      previewEnabledOfMatched: 1, // u1 only -- u3 isn't in the matched set
      contactRevealedOfMatched: 1, // u2 only
    });
  });
});

describe("getScoreAnalysis", () => {
  beforeEach(() => {
    fitmentLeadsSelectMock.mockReset();
    fitmentInterviewsSelectMock.mockReset();
  });

  function chainOf(finalData: unknown) {
    const eq2 = vi.fn().mockResolvedValue({ data: finalData });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    return { eq: eq1 };
  }

  it("excludes overridden rows, buckets scores, and correlates paired READY reports by lead_id", async () => {
    fitmentLeadsSelectMock.mockReturnValue(
      chainOf([
        { id: "lead-1", user_id: "u1", role_title: "SDE", resume_match_status: "READY", resume_match_score: 20 },
        { id: "lead-2", user_id: "u2", role_title: "SDE", resume_match_status: "READY", resume_match_score: 90 },
      ])
    );
    fitmentInterviewsSelectMock.mockReturnValue(
      chainOf([
        { user_id: "u1", role_title: "SDE", lead_id: "lead-1", status: "ready", report_raw: { overallScore: 2 } },
        { user_id: "u2", role_title: "SDE", lead_id: "lead-2", status: "ready", report_raw: { overallScore: 9 } },
      ])
    );

    const { getScoreAnalysis } = await import("../adminAnalytics");
    const result = await getScoreAnalysis();

    expect(result.fitmentDistribution.find((b) => b.label === "20-30")?.count).toBe(1);
    expect(result.fitmentDistribution.find((b) => b.label === "90-100")?.count).toBe(1);
    expect(result.interviewDistribution.find((b) => b.label === "2-3")?.count).toBe(1);
    expect(result.correlationSampleSize).toBe(2);
    expect(result.correlation).toBeCloseTo(1, 5); // perfectly aligned low/high pairs
  });

  it("matches a lead_id = null interview by role_title, exactly as before the lead_id cutover", async () => {
    fitmentLeadsSelectMock.mockReturnValue(
      chainOf([
        // Two different users sharing the same role_title -- if the fallback
        // key omitted user_id this would wrongly cross-match between them.
        { id: "lead-1", user_id: "u1", role_title: "SDE", resume_match_status: "READY", resume_match_score: 20 },
        { id: "lead-2", user_id: "u2", role_title: "SDE", resume_match_status: "READY", resume_match_score: 90 },
      ])
    );
    fitmentInterviewsSelectMock.mockReturnValue(
      chainOf([
        // Historical, unbackfilled rows -- lead_id is null, so this must
        // still resolve via role_title or the pairing silently disappears.
        { user_id: "u1", role_title: "SDE", lead_id: null, status: "ready", report_raw: { overallScore: 2 } },
        { user_id: "u2", role_title: "SDE", lead_id: null, status: "ready", report_raw: { overallScore: 9 } },
      ])
    );

    const { getScoreAnalysis } = await import("../adminAnalytics");
    const result = await getScoreAnalysis();

    expect(result.correlationSampleSize).toBe(2);
    expect(result.correlation).toBeCloseTo(1, 5);
  });

  it("returns null correlation with fewer than 2 paired points", async () => {
    fitmentLeadsSelectMock.mockReturnValue(chainOf([{ id: "lead-1", user_id: "u1", role_title: "SDE", resume_match_status: "READY", resume_match_score: 50 }]));
    fitmentInterviewsSelectMock.mockReturnValue(chainOf([]));

    const { getScoreAnalysis } = await import("../adminAnalytics");
    const result = await getScoreAnalysis();

    expect(result.correlation).toBeNull();
    expect(result.correlationSampleSize).toBe(0);
  });

  it("does not fall through to a different interview's role_title score when the id-matched interview has no score of its own", async () => {
    fitmentLeadsSelectMock.mockReturnValue(
      chainOf([
        { id: "lead-x", user_id: "u2", role_title: "SDE", resume_match_status: "READY", resume_match_score: 10 },
        { id: "lead-y", user_id: "u3", role_title: "SDE", resume_match_status: "READY", resume_match_score: 90 },
        // The trap: lead-1's own interview (linked by lead_id) has no
        // usable score yet, but a DIFFERENT, unlinked interview for the
        // same user_id+role_title does. A `??`-based join would wrongly
        // fall through to that other interview's score; `.has()` must
        // report "no score" for lead-1 instead.
        { id: "lead-1", user_id: "u1", role_title: "SDE", resume_match_status: "READY", resume_match_score: 50 },
      ])
    );
    fitmentInterviewsSelectMock.mockReturnValue(
      chainOf([
        { user_id: "u2", role_title: "SDE", lead_id: "lead-x", status: "ready", report_raw: { overallScore: 1 } },
        { user_id: "u3", role_title: "SDE", lead_id: "lead-y", status: "ready", report_raw: { overallScore: 9 } },
        // Exact id link to lead-1, but not scored yet -- `.has()` on this
        // key must be true while `.get()` is undefined.
        { user_id: "u1", role_title: "SDE", lead_id: "lead-1", status: "ready", report_raw: null },
        // Unlinked (lead_id null) interview for the same user+role_title,
        // with a real score -- must never be attributed to lead-1.
        { user_id: "u1", role_title: "SDE", lead_id: null, status: "ready", report_raw: { overallScore: 9 } },
      ])
    );

    const { getScoreAnalysis } = await import("../adminAnalytics");
    const result = await getScoreAnalysis();

    // Only lead-x/lead-y pair up (perfectly correlated). lead-1 must be
    // excluded, not paired with the unlinked interview's overallScore: 9 --
    // that wrong pairing would both add a 3rd sample and drag correlation
    // below 1.
    expect(result.correlationSampleSize).toBe(2);
    expect(result.correlation).toBeCloseTo(1, 5);
  });
});
