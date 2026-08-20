import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateInterviewReport } from "@/lib/intervuebox/interviewReports";
import { logAdminAction } from "@/lib/adminAuditLog";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: row, error } = await supabase
    .from("fitment_interviews")
    .select("id, ib_agent_id, ib_candidate_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return Response.json({ error: "Interview not found." }, { status: 404 });
  }

  try {
    await generateInterviewReport(row.ib_agent_id, [row.ib_candidate_id]);
  } catch (err) {
    console.error("Admin generate-report request failed", { id, error: err });
    return Response.json({ error: "IntervueBox rejected the generate request." }, { status: 502 });
  }

  const requestedAt = new Date().toISOString();
  await supabase.from("fitment_interviews").update({ report_generation_requested_at: requestedAt }).eq("id", id);

  try {
    await logAdminAction({
      adminEmail: admin.email as string,
      action: "interview.generate",
      targetType: "interview",
      targetId: id,
      newValue: { requestedAt },
    });
  } catch (error) {
    console.error("Failed to log admin action interview.generate", { id, error });
  }

  return Response.json({ ok: true });
}
