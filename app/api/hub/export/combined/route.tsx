import { renderToBuffer } from "@react-pdf/renderer";
import { Document } from "@react-pdf/renderer";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getCandidateResumeDetails, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { InterviewReportReady } from "@/lib/intervuebox/interviewReports";
import type { Scores, Validity } from "@/lib/personality";
import { nameFromEmail } from "@/lib/personality";
import PdfPage from "@/lib/pdf/PdfPage";
import { FitmentPdfContent } from "../../report/export/FitmentReportPdf";
import { PersonalityPdfContent } from "../../personality/export/PersonalityReportPdf";
import { InterviewPdfContent } from "../../interview/export/InterviewReportPdf";

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
  const include = new Set((url.searchParams.get("include") ?? "").split(",").filter(Boolean));
  const roleTitle = url.searchParams.get("role");

  const pages: React.ReactNode[] = [];

  if (include.has("fitment")) {
    const { data: leads } = await supabase
      .from("fitment_leads")
      .select("role_title, score, name, resume_match_status, resume_match_raw, ib_applied_job_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const current = leads?.[0];
    if (current) {
      const unlocked = await isReportUnlocked(user.id, current.role_title);
      if (unlocked && current.resume_match_status === "READY" && current.resume_match_raw) {
        const report = current.resume_match_raw as ResumeMatchReportReady;
        const candidateDetails = current.ib_applied_job_id
          ? await getCandidateResumeDetails(current.ib_applied_job_id).catch(() => null)
          : null;
        const formattedDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
        pages.push(
          <PdfPage key="fitment" title="Fitment Report">
            <FitmentPdfContent
              displayName={current.name || user.email || "Candidate"}
              roleTitle={current.role_title}
              formattedDate={formattedDate}
              score={current.score}
              report={report}
              candidateDetails={candidateDetails}
            />
          </PdfPage>
        );
      }
    }
  }

  if (include.has("personality") && roleTitle) {
    const { data: existing } = await supabase
      .from("personality_tests")
      .select("scores, validity")
      .eq("user_id", user.id)
      .eq("role_title", roleTitle)
      .maybeSingle();
    if (existing?.scores && existing?.validity) {
      pages.push(
        <PdfPage key="personality" title="Personality Profile">
          <PersonalityPdfContent
            candidateName={nameFromEmail(user.email ?? "")}
            roleTitle={roleTitle}
            scores={existing.scores as Scores}
            validity={existing.validity as Validity}
          />
        </PdfPage>
      );
    }
  }

  if (include.has("interview")) {
    let query = supabase
      .from("fitment_interviews")
      .select("role_title, status, report_raw, updated_at")
      .eq("user_id", user.id);
    if (roleTitle) {
      query = query.eq("role_title", roleTitle);
    }
    const { data: interview } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (interview && interview.status === "ready" && interview.report_raw) {
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
      pages.push(
        <PdfPage key="interview" title="AI Interview Report">
          <InterviewPdfContent
            displayName={lead?.name || user.email || "Candidate"}
            roleTitle={interview.role_title}
            infoLine={infoLine}
            report={report}
          />
        </PdfPage>
      );
    }
  }

  if (pages.length === 0) {
    return Response.json({ error: "None of the requested reports are ready yet." }, { status: 404 });
  }

  const buffer = await renderToBuffer(<Document>{pages}</Document>);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="merito-report.pdf"`,
    },
  });
}
