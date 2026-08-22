import { getSupabaseServerClient } from "@/lib/supabase";
import { fetchAllCandidates, FUNNEL_STAGES, FUNNEL_STAGE_LABEL, type FunnelStage } from "@/lib/adminCandidates";

export type FunnelDropoffRow = {
  stage: FunnelStage;
  label: string;
  count: number;
  pctOfStart: number;
  pctOfPrevious: number | null;
};

// "Reached this stage or further" counts, not "stopped exactly here" --
// matches how computeFunnelStage already models progress as a single
// highest-stage-reached value per candidate, so a later stage's count is
// always <= every earlier stage's (a true funnel, not a histogram).
export async function getFunnelDropoff(): Promise<FunnelDropoffRow[]> {
  const candidates = await fetchAllCandidates();
  const total = candidates.length;
  const stageIndex = new Map(FUNNEL_STAGES.map((s, i) => [s, i]));

  const reachedCounts = FUNNEL_STAGES.map((stage) => {
    const minIndex = stageIndex.get(stage)!;
    return candidates.filter((c) => stageIndex.get(c.funnelStage)! >= minIndex).length;
  });

  return FUNNEL_STAGES.map((stage, i) => ({
    stage,
    label: FUNNEL_STAGE_LABEL[stage],
    count: reachedCounts[i],
    pctOfStart: total === 0 ? 0 : Math.round((reachedCounts[i] / total) * 1000) / 10,
    pctOfPrevious: i === 0 || reachedCounts[i - 1] === 0 ? null : Math.round((reachedCounts[i] / reachedCounts[i - 1]) * 1000) / 10,
  }));
}

export type RoleTitleBreakdownRow = { roleTitle: string; total: number } & Record<FunnelStage, number>;

export async function getRoleTitleBreakdown(): Promise<RoleTitleBreakdownRow[]> {
  const candidates = await fetchAllCandidates();
  const stageIndex = new Map(FUNNEL_STAGES.map((s, i) => [s, i]));

  const byRole = new Map<string, RoleTitleBreakdownRow>();
  for (const c of candidates) {
    let row = byRole.get(c.latestRoleTitle);
    if (!row) {
      row = { roleTitle: c.latestRoleTitle, total: 0, ...(Object.fromEntries(FUNNEL_STAGES.map((s) => [s, 0])) as Record<FunnelStage, number>) };
      byRole.set(c.latestRoleTitle, row);
    }
    row.total += 1;
    const reachedIndex = stageIndex.get(c.funnelStage)!;
    for (const stage of FUNNEL_STAGES) {
      if (stageIndex.get(stage)! <= reachedIndex) row[stage] += 1;
    }
  }

  return Array.from(byRole.values()).sort((a, b) => b.total - a.total);
}

export type RevenueBreakdown = {
  totalPaise: number;
  totalThisMonthPaise: number;
  byProduct: { product: string; amountPaise: number; count: number }[];
  byRoleTitle: { roleTitle: string; amountPaise: number; count: number }[];
};

export async function getRevenueBreakdown(): Promise<RevenueBreakdown> {
  const supabase = getSupabaseServerClient();
  const [{ data: txnRows }, { data: leadRows }] = await Promise.all([
    supabase.from("razorpay_transactions").select("product, lead_id, amount_paise, created_at").eq("status", "success"),
    supabase.from("fitment_leads").select("id, role_title"),
  ]);

  const roleByLead = new Map((leadRows ?? []).map((l) => [l.id, l.role_title]));
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  let totalPaise = 0;
  let totalThisMonthPaise = 0;
  const byProduct = new Map<string, { amountPaise: number; count: number }>();
  const byRoleTitle = new Map<string, { amountPaise: number; count: number }>();

  for (const t of txnRows ?? []) {
    totalPaise += t.amount_paise;
    if (new Date(t.created_at) >= monthStart) totalThisMonthPaise += t.amount_paise;

    const productEntry = byProduct.get(t.product) ?? { amountPaise: 0, count: 0 };
    productEntry.amountPaise += t.amount_paise;
    productEntry.count += 1;
    byProduct.set(t.product, productEntry);

    const roleTitle = t.lead_id ? (roleByLead.get(t.lead_id) ?? "Unknown") : "Not role-linked";
    const roleEntry = byRoleTitle.get(roleTitle) ?? { amountPaise: 0, count: 0 };
    roleEntry.amountPaise += t.amount_paise;
    roleEntry.count += 1;
    byRoleTitle.set(roleTitle, roleEntry);
  }

  return {
    totalPaise,
    totalThisMonthPaise,
    byProduct: Array.from(byProduct.entries())
      .map(([product, v]) => ({ product, ...v }))
      .sort((a, b) => b.amountPaise - a.amountPaise),
    byRoleTitle: Array.from(byRoleTitle.entries())
      .map(([roleTitle, v]) => ({ roleTitle, ...v }))
      .sort((a, b) => b.amountPaise - a.amountPaise),
  };
}

function startOfWeek(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday-anchored
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export type WeeklyTrendPoint = { weekStart: string; newCandidates: number; revenuePaise: number };

// Point-in-time-only was the roadmap's own complaint about this page. Real
// funnel-stage-over-time isn't recoverable from this schema (no transition
// timestamps are stored, only the current stage) -- but signups and revenue
// both have a clean created_at, so those are what actually trend here.
export async function getWeeklyTrends(weeksBack: number = 12): Promise<WeeklyTrendPoint[]> {
  const supabase = getSupabaseServerClient();
  const [candidates, { data: txnRows }] = await Promise.all([
    fetchAllCandidates(),
    supabase.from("razorpay_transactions").select("amount_paise, created_at").eq("status", "success"),
  ]);

  const weeks: string[] = [];
  const cursor = new Date(startOfWeek(new Date().toISOString()));
  for (let i = 0; i < weeksBack; i++) {
    weeks.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  const weekSet = new Set(weeks);

  const signupsByWeek = new Map<string, number>();
  for (const c of candidates) {
    const week = startOfWeek(c.firstSeenAt);
    if (weekSet.has(week)) signupsByWeek.set(week, (signupsByWeek.get(week) ?? 0) + 1);
  }

  const revenueByWeek = new Map<string, number>();
  for (const t of txnRows ?? []) {
    const week = startOfWeek(t.created_at);
    if (weekSet.has(week)) revenueByWeek.set(week, (revenueByWeek.get(week) ?? 0) + t.amount_paise);
  }

  return weeks.map((weekStart) => ({
    weekStart,
    newCandidates: signupsByWeek.get(weekStart) ?? 0,
    revenuePaise: revenueByWeek.get(weekStart) ?? 0,
  }));
}

export type RecruiterEngagementFunnel = {
  totalLookups: number;
  matchedCandidates: number;
  previewEnabledOfMatched: number;
  contactRevealedOfMatched: number;
};

// Scoped to the extension-lookup -> preview -> reveal path only -- the
// separate recruiter-sourced-prospect growth loop (lib/recruiterSourcedProspects.ts,
// lib/prospectShortlist.ts) tracks external LinkedIn leads that were never
// looked up through the extension at all, so folding it into this funnel
// would mix two different populations into one misleading number.
export async function getRecruiterEngagementFunnel(): Promise<RecruiterEngagementFunnel> {
  const supabase = getSupabaseServerClient();
  const [{ count: totalLookups }, { data: lookupRows }, { data: previewRows }, { data: contactRows }] = await Promise.all([
    supabase.from("extension_lookups").select("id", { count: "exact", head: true }),
    supabase.from("extension_lookups").select("matched_user_id").not("matched_user_id", "is", null),
    supabase.from("recruiter_preview_settings").select("user_id").eq("enabled", true),
    supabase.from("contact_detail_requests").select("user_id"),
  ]);

  const matchedUserIds = new Set((lookupRows ?? []).map((r) => r.matched_user_id as string));
  const previewEnabledUserIds = new Set((previewRows ?? []).map((r) => r.user_id as string));
  const contactRevealedUserIds = new Set((contactRows ?? []).map((r) => r.user_id as string));

  let previewEnabledOfMatched = 0;
  let contactRevealedOfMatched = 0;
  for (const userId of matchedUserIds) {
    if (previewEnabledUserIds.has(userId)) previewEnabledOfMatched += 1;
    if (contactRevealedUserIds.has(userId)) contactRevealedOfMatched += 1;
  }

  return {
    totalLookups: totalLookups ?? 0,
    matchedCandidates: matchedUserIds.size,
    previewEnabledOfMatched,
    contactRevealedOfMatched,
  };
}

export type HistogramBucket = { label: string; count: number };

function bucketize(values: number[], bucketSize: number, max: number): HistogramBucket[] {
  const bucketCount = Math.ceil(max / bucketSize);
  const counts = new Array(bucketCount).fill(0);
  for (const v of values) {
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor(v / bucketSize)));
    counts[idx] += 1;
  }
  return counts.map((count, i) => ({ label: `${i * bucketSize}-${(i + 1) * bucketSize}`, count }));
}

function pearsonCorrelation(pairs: Array<[number, number]>): number | null {
  const n = pairs.length;
  if (n < 2) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX === 0 || varY === 0) return null;
  return cov / Math.sqrt(varX * varY);
}

export type ScoreAnalysis = {
  fitmentDistribution: HistogramBucket[];
  interviewDistribution: HistogramBucket[];
  correlation: number | null;
  correlationSampleSize: number;
};

// Excludes admin-overridden scores from every part of this analysis -- a
// manually-corrected score is the admin's judgment, not the vendor's
// organic signal, and would corrupt both the distributions and the
// correlation if left in (this is exactly the corruption risk the roadmap
// flagged before this item could be built at all -- Phase 4's
// resume_match_overridden / Phase 5's report_overridden are what make it
// safe to build now).
export async function getScoreAnalysis(): Promise<ScoreAnalysis> {
  const supabase = getSupabaseServerClient();
  const [{ data: leadRows }, { data: interviewRows }] = await Promise.all([
    supabase
      .from("fitment_leads")
      .select("id, user_id, role_title, resume_match_status, resume_match_score, resume_match_overridden")
      .eq("resume_match_status", "READY")
      .eq("resume_match_overridden", false),
    supabase
      .from("fitment_interviews")
      .select("user_id, role_title, lead_id, status, report_raw, report_overridden")
      .eq("status", "ready")
      .eq("report_overridden", false),
  ]);

  const fitmentScores = (leadRows ?? []).map((r) => r.resume_match_score as number).filter((s) => Number.isFinite(s));
  const interviewScores = (interviewRows ?? [])
    .map((r) => (r.report_raw as { overallScore?: number } | null)?.overallScore)
    .filter((s): s is number => Number.isFinite(s));

  // Keyed by the interview's own lead_id when present -- an exact,
  // collision-free link to the one lead it was scored against -- falling
  // back to role_title only for historical rows that predate the lead_id
  // backfill (migration 0049_fitment_interviews_lead_id.sql leaves lead_id
  // null when no match could be found; those rows must keep matching by
  // role_title exactly as they did before this change).
  const interviewScoreByKey = new Map(
    (interviewRows ?? []).map((r) => [
      `${r.user_id}:${(r.lead_id as string | null) ?? r.role_title}`,
      (r.report_raw as { overallScore?: number } | null)?.overallScore,
    ])
  );

  const pairs: Array<[number, number]> = [];
  for (const lead of leadRows ?? []) {
    const idKey = `${lead.user_id}:${lead.id}`;
    const roleKey = `${lead.user_id}:${lead.role_title}`;
    // .has() (not `??`) so an interview that IS linked by lead_id but lacks
    // a usable score doesn't silently fall through to a different
    // interview's role_title-matched score -- an exact id link, once it
    // exists, is authoritative even when its own value is undefined.
    const interviewScore = interviewScoreByKey.has(idKey) ? interviewScoreByKey.get(idKey) : interviewScoreByKey.get(roleKey);
    const fitmentScore = lead.resume_match_score as number;
    if (Number.isFinite(fitmentScore) && Number.isFinite(interviewScore)) {
      pairs.push([fitmentScore, interviewScore as number]);
    }
  }

  return {
    fitmentDistribution: bucketize(fitmentScores, 10, 100),
    interviewDistribution: bucketize(interviewScores, 1, 10),
    correlation: pearsonCorrelation(pairs),
    correlationSampleSize: pairs.length,
  };
}

export type DataQualityStats = {
  interviewsReady: number;
  interviewsMissingSkillReport: number;
  fitmentReady: number;
  fitmentMissingResumeText: number;
  fitmentMissingCategories: number;
};

// DB-only, no live vendor calls -- this is meant to be cheap enough to load
// on every /admin visit, unlike VendorCompare (Phase 5) which is on-demand.
export async function getDataQualityStats(): Promise<DataQualityStats> {
  const supabase = getSupabaseServerClient();
  const [{ data: interviewRows }, { data: leadRows }] = await Promise.all([
    supabase.from("fitment_interviews").select("report_raw").eq("status", "ready"),
    supabase.from("fitment_leads").select("resume_text, resume_match_status, resume_match_raw").eq("resume_match_status", "READY"),
  ]);

  const interviewsReady = interviewRows?.length ?? 0;
  const interviewsMissingSkillReport = (interviewRows ?? []).filter((r) => {
    const skillReport = (r.report_raw as { skillReport?: Record<string, unknown> } | null)?.skillReport;
    return !skillReport || Object.keys(skillReport).length === 0;
  }).length;

  const fitmentReady = leadRows?.length ?? 0;
  const fitmentMissingResumeText = (leadRows ?? []).filter((r) => !r.resume_text || r.resume_text.trim().length === 0).length;
  const fitmentMissingCategories = (leadRows ?? []).filter((r) => {
    const categories = (r.resume_match_raw as { categories?: unknown[] } | null)?.categories;
    return !categories || categories.length === 0;
  }).length;

  return { interviewsReady, interviewsMissingSkillReport, fitmentReady, fitmentMissingResumeText, fitmentMissingCategories };
}
