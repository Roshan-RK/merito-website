import { getSupabaseServerClient } from "@/lib/supabase";
import { getResumeMatchReport, scoreOutOfTen } from "@/lib/intervuebox/reports";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

const checkIpRateLimit = createRateLimiter({ max: 60, windowMs: 60 * 60 * 1000 });

export async function GET(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkIpRateLimit(ip)) {
    return Response.json({ error: "Too many requests — please try again later." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");
  if (!leadId) {
    return Response.json({ error: "leadId is required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("ib_applied_job_id, resume_match_status, score, verdict")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ error: "Fitment check not found." }, { status: 404 });
  }

  if (lead.resume_match_status === "READY") {
    return Response.json({ status: "ready", score: lead.score, verdict: lead.verdict });
  }

  const report = await getResumeMatchReport(lead.ib_applied_job_id).catch((err) => {
    console.error("getResumeMatchReport failed, treating as pending", err);
    return { status: "PENDING" as const };
  });

  if (report.status === "PENDING") {
    return Response.json({ status: "pending" });
  }

  const score = scoreOutOfTen(report.overallScore);
  // IntervueBox can return a null summary on an otherwise-READY report
  // (live-confirmed) -- verdict is NOT NULL, so a bare pass-through 500s
  // this update even though the score itself is valid.
  const verdict = report.summary || "No summary available.";
  const { error: updateError } = await supabase
    .from("fitment_leads")
    .update({
      score,
      verdict,
      resume_match_status: "READY",
      resume_match_score: report.overallScore,
      resume_match_raw: {
        overallScore: report.overallScore,
        rank: report.rank,
        categories: report.categories,
        summary: report.summary,
        strongPoints: report.strongPoints,
        weakPoints: report.weakPoints,
      },
    })
    .eq("id", leadId);

  if (updateError) {
    return Response.json({ error: "Something went wrong updating your result." }, { status: 500 });
  }

  return Response.json({ status: "ready", score, verdict });
}
