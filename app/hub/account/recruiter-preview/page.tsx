import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus, computeReferenceReport } from "@/lib/referenceChecks";
import { nameFromEmail, type Scores } from "@/lib/personality";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import RecruiterPreviewClient from "./RecruiterPreviewClient";

export default async function RecruiterPreviewPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("role_title, name, resume_match_status, resume_match_raw")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const currentLead = leads?.[0] ?? null;
  const roleTitle = currentLead?.role_title ?? null;
  const candidateName = currentLead?.name || nameFromEmail(user.email ?? "");

  const fitment: ResumeMatchReportReady | null =
    currentLead && currentLead.resume_match_status === "READY" && currentLead.resume_match_raw
      ? (currentLead.resume_match_raw as ResumeMatchReportReady)
      : null;

  let personality: Scores | null = null;
  if (roleTitle) {
    const { data: personalityRow } = await supabase
      .from("personality_tests")
      .select("scores")
      .eq("user_id", user.id)
      .eq("role_title", roleTitle)
      .maybeSingle();
    personality = (personalityRow?.scores as Scores | undefined) ?? null;
  }

  let interview: InterviewReportReady | null = null;
  if (roleTitle) {
    const { data: interviewRow } = await supabase
      .from("fitment_interviews")
      .select("status, report_raw")
      .eq("user_id", user.id)
      .eq("role_title", roleTitle)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    interview =
      interviewRow && interviewRow.status === "ready" && interviewRow.report_raw
        ? (interviewRow.report_raw as InterviewReportReady)
        : null;
  }

  const referenceStatus = await getReferenceCheckStatus(user.id);
  const references = referenceStatus?.status === "completed" ? computeReferenceReport(referenceStatus.referees) : null;

  const { data: settingsRow } = await supabase
    .from("recruiter_preview_settings")
    .select("enabled, sections, linkedin_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <RecruiterPreviewClient
      roleTitle={roleTitle}
      candidateName={candidateName}
      fitment={fitment}
      personality={personality}
      interview={interview}
      references={references}
      initialEnabled={settingsRow?.enabled ?? false}
      initialSections={(settingsRow?.sections as string[] | undefined) ?? []}
      initialLinkedinUrl={settingsRow?.linkedin_url ?? null}
    />
  );
}
