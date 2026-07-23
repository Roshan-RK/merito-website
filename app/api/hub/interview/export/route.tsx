import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getCandidateResumeDetails } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import InterviewReportPdf from "./InterviewReportPdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const roleTitle = url.searchParams.get("role");

  let query = supabase
    .from("fitment_interviews")
    .select("role_title, status, report_raw, updated_at")
    .eq("user_id", user.id);

  if (roleTitle) {
    query = query.eq("role_title", roleTitle);
  }

  const { data: interview } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();

  if (!interview) {
    return Response.json({ error: "No AI interview found." }, { status: 404 });
  }
  if (interview.status !== "ready" || !interview.report_raw) {
    return Response.json({ error: "Interview report not ready yet." }, { status: 404 });
  }

  const report = interview.report_raw as InterviewReportReady;

  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("name, ib_applied_job_id")
    .eq("user_id", user.id)
    .eq("role_title", interview.role_title)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const candidateDetails = lead?.ib_applied_job_id
    ? await getCandidateResumeDetails(lead.ib_applied_job_id).catch(() => null)
    : null;

  const organisation = candidateDetails?.experience[0]?.company ?? null;
  const location = candidateDetails?.location ?? null;
  const totalExperience = candidateDetails?.totalExperience ?? null;
  const displayName = lead?.name || user.email || "Candidate";
  const formattedDate = new Date(interview.updated_at).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const infoLine = [
    organisation,
    totalExperience != null ? `${totalExperience} yrs experience` : null,
    location,
    formattedDate,
    report.approxDurationMinutes != null ? `~${report.approxDurationMinutes} min` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  const buffer = await renderToBuffer(
    <InterviewReportPdf displayName={displayName} roleTitle={interview.role_title} infoLine={infoLine} report={report} />
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="interview-report.pdf"`,
    },
  });
}
