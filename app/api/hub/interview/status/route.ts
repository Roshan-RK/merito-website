import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getInterviewReport } from "@/lib/intervuebox/interviewReports";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  if (!role) {
    return Response.json({ error: "role is required." }, { status: 400 });
  }

  const { data } = await supabase
    .from("fitment_interviews")
    .select("id, status, ib_agent_id, ib_candidate_id, stuck_at")
    .eq("user_id", user.id)
    .eq("role_title", role)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return Response.json({ status: "not_started" });
  }

  if (data.status === "ready") {
    return Response.json({ status: "ready" });
  }

  // Same self-heal as the dashboard's own SSR read -- this poll is the
  // fallback path for "still on the page waiting," so it should catch a
  // missed webhook just as reliably as a fresh page load would.
  try {
    const interviewReport = await getInterviewReport(data.ib_agent_id, data.ib_candidate_id);
    if (interviewReport.status === "READY") {
      const admin = getSupabaseServerClient();
      await admin
        .from("fitment_interviews")
        .update({
          status: "ready",
          // A row that self-resolves here may have had stuck_at set by a
          // doomed resume/launch call racing the report's real arrival --
          // clear it so the admin "Interview stuck" count doesn't keep
          // counting a row that no longer needs help.
          stuck_at: null,
          report_raw: {
            overallScore: interviewReport.overallScore,
            skillMetrics: interviewReport.skillMetrics,
            overallSummary: interviewReport.overallSummary,
            strengths: interviewReport.strengths,
            areasOfImprovement: interviewReport.areasOfImprovement,
            shareableReportLink: interviewReport.shareableReportLink,
            approxDurationMinutes: interviewReport.approxDurationMinutes,
            flagForSuspiciousActivity: interviewReport.flagForSuspiciousActivity,
            integrityCheck: interviewReport.integrityCheck,
            videoReport: interviewReport.videoReport,
            feedbackToInterviewer: interviewReport.feedbackToInterviewer,
            roadmap: interviewReport.roadmap,
            criteriaEvaluationTable: interviewReport.criteriaEvaluationTable,
            interviewTitle: interviewReport.interviewTitle,
            skillReport: interviewReport.skillReport,
            overallSkillScore: interviewReport.overallSkillScore,
            answers: interviewReport.answers,
            knowledgeAnswers: interviewReport.knowledgeAnswers,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      return Response.json({ status: "ready" });
    }
  } catch (err) {
    console.error("Interview self-heal check failed, leaving status as-is", err);
  }

  // Surface stuck_at here too -- otherwise a row that goes stuck via
  // launch-link (status stays "invited") reports back "invited" forever to
  // the dashboard's poll loop, which keeps silently retrying instead of
  // ever showing the candidate the stuck card. See
  // docs/superpowers/specs/2026-08-19-interview-stuck-state-design.md.
  if (data.stuck_at) {
    return Response.json({ status: "stuck" });
  }

  return Response.json({ status: data.status === "terminated" ? "terminated" : "invited" });
}
