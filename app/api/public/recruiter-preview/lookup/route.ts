import { getSupabaseServerClient } from "@/lib/supabase";
import { nameFromEmail, type Scores } from "@/lib/personality";
import { normalizeLinkedinUrl, LINKEDIN_URL_PATTERN } from "@/lib/linkedinUrl";
import { recordLookup } from "@/lib/extensionLookups";
import { isRecruiterEmailVerified } from "@/lib/recruiterIdentity";
import {
  buildLookupFitment,
  buildLookupPersonality,
  buildLookupInterview,
} from "@/lib/recruiterPreview";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import { leadIdOrRoleTitleFilter } from "@/lib/postgrestIdentityFilter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expectedKey = process.env.RECRUITER_EXTENSION_KEY;
  const providedKey = request.headers.get("x-merito-extension-key");
  if (!expectedKey || providedKey !== expectedKey) {
    return Response.json({ error: "Invalid key." }, { status: 401 });
  }

  const userAgent = request.headers.get("user-agent") || "";
  const isOldClient =
    userAgent.includes("merito-extension/1.") || userAgent.includes("merito-extension/2.");
  if (isOldClient) {
    return Response.json(
      { error: "Please upgrade the Merito extension to v3.0+" },
      { status: 400 }
    );
  }

  let body: { linkedinUrl?: unknown; recruiterEmail?: unknown };
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

  if (typeof body.recruiterEmail !== "string" || body.recruiterEmail.trim().length === 0) {
    return Response.json({ error: "Please confirm your email first.", verificationRequired: true }, { status: 403 });
  }
  const recruiterEmail = body.recruiterEmail.trim();
  if (!(await isRecruiterEmailVerified(recruiterEmail))) {
    return Response.json({ error: "Please confirm your email first.", verificationRequired: true }, { status: 403 });
  }

  const admin = getSupabaseServerClient();

  const { data: settingsRow } = await admin
    .from("recruiter_preview_settings")
    .select("user_id")
    .eq("linkedin_url", normalized)
    .eq("enabled", true)
    .maybeSingle();

  await recordLookup({ linkedinUrl: normalized, matchedUserId: settingsRow?.user_id ?? null });

  if (!settingsRow) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const userId = settingsRow.user_id as string;

  // Fetch all leads (not just 1)
  const { data: leads } = await admin
    .from("fitment_leads")
    .select("id, role_title, name, resume_match_status, resume_match_raw, candidate_level")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!leads || leads.length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  // Fetch candidate name (same logic as before)
  let candidateName = leads[0]?.name as string | undefined;
  if (!candidateName) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    candidateName = nameFromEmail(authUser?.user?.email ?? "");
  }

  // Build roles array
  const roles = [];
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const { data: sectionRow } = await admin
      .from("recruiter_preview_sections")
      .select("sections")
      .eq("user_id", userId)
      .eq("lead_id", lead.id)
      .maybeSingle();

    // Skip if no section config
    if (!sectionRow) continue;

    const enabledSections = (sectionRow.sections as string[]) || [];
    const roleTitle = lead.role_title ?? null;
    const candidateLevel = (lead.candidate_level as "entry" | "mid" | "senior" | null) ?? "entry";

    // Build sections (only enabled ones)
    const sections: Record<string, any> = {};

    if (enabledSections.includes("fitment") && lead.resume_match_status === "READY" && lead.resume_match_raw && roleTitle) {
      sections.fitment = buildLookupFitment(lead.resume_match_raw as ResumeMatchReportReady, roleTitle);
    }

    if (enabledSections.includes("personality")) {
      const { data: personalityRow } = await admin
        .from("personality_tests")
        .select("scores, completed_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (personalityRow?.scores) {
        sections.personality = buildLookupPersonality(
          personalityRow.scores as Scores,
          candidateName,
          (personalityRow.completed_at as string | null) ?? null
        );
      }
    }

    if (enabledSections.includes("interview") && roleTitle) {
      const { data: interviewRow } = await admin
        .from("fitment_interviews")
        .select("status, report_raw, updated_at")
        .eq("user_id", userId)
        .or(leadIdOrRoleTitleFilter(lead.id, roleTitle))
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (interviewRow?.status === "ready" && interviewRow.report_raw) {
        sections.interview = buildLookupInterview(interviewRow.report_raw as InterviewReportReady, interviewRow.updated_at as string);
      }
    }

    roles.push({
      leadId: lead.id,
      roleTitle: lead.role_title,
      isCurrent: i === 0, // Latest is current
      candidateLevel,
      sections,
    });
  }

  return Response.json({
    candidateName,
    roles,
  });
}
