import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { reinviteInterviewCandidates } from "@/lib/intervuebox/invitations";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  await requireAdmin();

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
    const { invited } = await reinviteInterviewCandidates(row.ib_agent_id, [row.ib_candidate_id]);
    return Response.json({ ok: true, invited });
  } catch (err) {
    console.error("Admin reinvite request failed", { id, error: err });
    return Response.json({ error: "IntervueBox rejected the reinvite request." }, { status: 502 });
  }
}
