import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { unlockReport } from "@/lib/reportUnlocks";
import { getResumeMatchReport, scoreOutOfTen } from "@/lib/intervuebox/reports";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { roleTitle?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const roleTitle = typeof body.roleTitle === "string" ? body.roleTitle.trim() : "";
  if (!roleTitle) {
    return Response.json({ error: "roleTitle is required." }, { status: 400 });
  }

  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("id, ib_applied_job_id, resume_match_status, resume_match_raw")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ error: "No fitment check found for this role." }, { status: 400 });
  }

  try {
    await unlockReport(user.id, roleTitle);
  } catch {
    return Response.json({ error: "Something went wrong unlocking the report." }, { status: 500 });
  }

  if (lead.resume_match_status === "READY") {
    return Response.json({ status: "unlocked", report: lead.resume_match_raw });
  }

  let report;
  try {
    report = await getResumeMatchReport(lead.ib_applied_job_id);
  } catch {
    return Response.json({ error: "Unlocked, but the report failed to load — please refresh." }, { status: 500 });
  }

  if (report.status === "PENDING") {
    return Response.json({ status: "pending" });
  }

  const resumeMatchRaw = {
    overallScore: report.overallScore,
    rank: report.rank,
    categories: report.categories,
    summary: report.summary,
    strongPoints: report.strongPoints,
    weakPoints: report.weakPoints,
  };

  const admin = getSupabaseServerClient();
  const { error: updateError } = await admin
    .from("fitment_leads")
    .update({
      score: scoreOutOfTen(report.overallScore),
      verdict: report.summary,
      resume_match_status: "READY",
      resume_match_score: report.overallScore,
      resume_match_raw: resumeMatchRaw,
    })
    .eq("id", lead.id);

  if (updateError) {
    return Response.json({ error: "Unlocked, but the report failed to save — please refresh." }, { status: 500 });
  }

  return Response.json({ status: "unlocked", report: resumeMatchRaw });
}
