import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getResumeMatchReport } from "@/lib/intervuebox/reports";

type RouteContext = { params: Promise<{ leadId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  await requireAdmin();
  const { leadId } = await params;

  const supabase = getSupabaseServerClient();
  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("resume_match_status, resume_match_raw, ib_applied_job_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead || lead.resume_match_status !== "READY" || !lead.ib_applied_job_id) {
    return Response.json({ error: "Fitment report isn't ready yet — nothing to compare." }, { status: 409 });
  }

  try {
    const live = await getResumeMatchReport(lead.ib_applied_job_id);
    return Response.json({
      stored: lead.resume_match_raw,
      live: live.status === "READY" ? live : null,
      liveStatus: live.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch live vendor report.";
    return Response.json({ error: message }, { status: 502 });
  }
}
