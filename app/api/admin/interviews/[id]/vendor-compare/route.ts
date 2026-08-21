import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getInterviewReport } from "@/lib/intervuebox/interviewReports";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  await requireAdmin();
  const { id } = await params;

  const supabase = getSupabaseServerClient();
  const { data: row } = await supabase
    .from("fitment_interviews")
    .select("status, report_raw, ib_agent_id, ib_candidate_id")
    .eq("id", id)
    .maybeSingle();

  if (!row || row.status !== "ready") {
    return Response.json({ error: "Interview report isn't ready yet — nothing to compare." }, { status: 409 });
  }

  try {
    const live = await getInterviewReport(row.ib_agent_id, row.ib_candidate_id);
    return Response.json({
      stored: row.report_raw,
      live: live.status === "READY" ? live : null,
      liveStatus: live.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch live vendor report.";
    return Response.json({ error: message }, { status: 502 });
  }
}
