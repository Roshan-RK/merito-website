import { getSupabaseServerClient } from "@/lib/supabase";
import { getReferenceCheckStatus, computeReferenceReport } from "@/lib/referenceChecks";
import { nameFromEmail, TRAIT_NAME, TRAIT_WORK_IMPLICATION, BANDS, traitLevel, type Scores, type TraitKey } from "@/lib/personality";
import { normalizeLinkedinUrl, LINKEDIN_URL_PATTERN } from "@/lib/linkedinUrl";
import type { ResumeMatchReportReady, ResumeMatchCategory } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";

export const runtime = "nodejs";

type LookupFitmentReport = {
  overallScore: number;
  categories: ResumeMatchCategory[];
  summary: string;
};

type LookupInterview = {
  overallScore: number;
  skillMetrics: Record<string, number>;
  overallSummary: string;
  skillReport: Record<string, { score: number; comment: string }>;
  strengths: string | null;
  completedAt: string;
  approxDurationMinutes: number | null;
};

type LookupPersonalityTrait = {
  key: TraitKey;
  label: string;
  pct: number;
  bandLabel: string;
};

type LookupPersonality = {
  traits: LookupPersonalityTrait[];
  summary: string;
  completedAt: string | null;
};

const TRAIT_ORDER: TraitKey[] = ["E", "A", "C", "ES", "O"];

function buildPersonalitySummary(candidateName: string, traits: LookupPersonalityTrait[]): string {
  const firstName = candidateName.split(/\s+/)[0] || candidateName;
  const sorted = [...traits].sort((a, b) => b.pct - a.pct);
  const top = sorted[0];
  const second = sorted[1];
  if (!top || !second) return "";
  const workLine = TRAIT_WORK_IMPLICATION[top.key][traitLevel(top.pct)](firstName);
  return `${firstName} scores highest in ${top.label} and ${second.label}. ${workLine}`;
}

export async function POST(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  let body: { linkedinUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  if (typeof body.linkedinUrl !== "string" || body.linkedinUrl.trim().length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const normalized = normalizeLinkedinUrl(body.linkedinUrl.trim());
  if (!LINKEDIN_URL_PATTERN.test(normalized)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const admin = getSupabaseServerClient();

  const { data: settingsRow } = await admin
    .from("recruiter_preview_settings")
    .select("user_id, sections")
    .eq("linkedin_url", normalized)
    .eq("enabled", true)
    .maybeSingle();

  if (!settingsRow) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const userId = settingsRow.user_id as string;
  const sections = new Set((settingsRow.sections as string[] | null) ?? []);

  const { data: leads } = await admin
    .from("fitment_leads")
    .select("role_title, name, resume_match_status, resume_match_raw, candidate_level")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const currentLead = leads?.[0] ?? null;
  const roleTitle = currentLead?.role_title ?? null;
  const candidateLevel = (currentLead?.candidate_level as "entry" | "mid" | "senior" | null) ?? "entry";

  let candidateName = currentLead?.name as string | undefined;
  if (!candidateName) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    candidateName = nameFromEmail(authUser?.user?.email ?? "");
  }

  let fitment: { report: LookupFitmentReport; matchedAgainstRoleTitle: string } | null = null;
  if (
    sections.has("fitment") &&
    currentLead &&
    currentLead.resume_match_status === "READY" &&
    currentLead.resume_match_raw &&
    roleTitle
  ) {
    const fullFitment = currentLead.resume_match_raw as ResumeMatchReportReady;
    fitment = {
      report: {
        overallScore: fullFitment.overallScore,
        categories: fullFitment.categories,
        summary: fullFitment.summary,
      },
      matchedAgainstRoleTitle: roleTitle,
    };
  }

  let personality: LookupPersonality | null = null;
  if (sections.has("personality") && roleTitle) {
    const { data: personalityRow } = await admin
      .from("personality_tests")
      .select("scores, completed_at")
      .eq("user_id", userId)
      .eq("role_title", roleTitle)
      .maybeSingle();
    if (personalityRow?.scores) {
      const scores = personalityRow.scores as Scores;
      const traits = TRAIT_ORDER.filter((key) => scores[key]).map((key) => ({
        key,
        label: TRAIT_NAME[key],
        pct: scores[key].pct,
        bandLabel: BANDS[scores[key].band],
      }));
      personality = {
        traits,
        summary: buildPersonalitySummary(candidateName, traits),
        completedAt: (personalityRow.completed_at as string | null) ?? null,
      };
    }
  }

  let interview: LookupInterview | null = null;
  if (sections.has("interview") && roleTitle) {
    const { data: interviewRow } = await admin
      .from("fitment_interviews")
      .select("status, report_raw, updated_at")
      .eq("user_id", userId)
      .eq("role_title", roleTitle)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (interviewRow && interviewRow.status === "ready" && interviewRow.report_raw) {
      const full = interviewRow.report_raw as InterviewReportReady;
      interview = {
        overallScore: full.overallScore,
        skillMetrics: full.skillMetrics,
        overallSummary: full.overallSummary,
        skillReport: full.skillReport,
        strengths: full.strengths,
        completedAt: interviewRow.updated_at as string,
        approxDurationMinutes: full.approxDurationMinutes,
      };
    }
  }

  let references: ReturnType<typeof computeReferenceReport> | null = null;
  if (sections.has("references")) {
    const referenceStatus = await getReferenceCheckStatus(userId);
    if (referenceStatus?.status === "completed") {
      references = computeReferenceReport(referenceStatus.referees);
    }
  }

  return Response.json({
    candidateName,
    roleTitle,
    candidateLevel,
    sections: Array.from(sections),
    fitment,
    personality,
    interview,
    references,
  });
}
