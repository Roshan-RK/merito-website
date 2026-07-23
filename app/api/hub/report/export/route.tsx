import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getCandidateResumeDetails, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import FitmentReportPdf from "./FitmentReportPdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("role_title, score, name, resume_match_status, resume_match_raw, ib_applied_job_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const current = leads?.[0];
  if (!current) {
    return Response.json({ error: "No fitment report found." }, { status: 404 });
  }

  const unlocked = await isReportUnlocked(user.id, current.role_title);
  if (!unlocked) {
    return Response.json({ error: "Report not unlocked." }, { status: 403 });
  }

  if (current.resume_match_status !== "READY" || !current.resume_match_raw) {
    return Response.json({ error: "Report not ready yet." }, { status: 404 });
  }

  const report = current.resume_match_raw as ResumeMatchReportReady;

  const candidateDetails = current.ib_applied_job_id
    ? await getCandidateResumeDetails(current.ib_applied_job_id).catch(() => null)
    : null;

  const displayName = current.name || user.email || "Candidate";
  const formattedDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

  const buffer = await renderToBuffer(
    <FitmentReportPdf
      displayName={displayName}
      roleTitle={current.role_title}
      formattedDate={formattedDate}
      score={current.score}
      report={report}
      candidateDetails={candidateDetails}
    />
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fitment-report.pdf"`,
    },
  });
}
