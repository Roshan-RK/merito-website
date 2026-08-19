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
    const { invited, magicLinks } = await reinviteInterviewCandidates(row.ib_agent_id, [row.ib_candidate_id]);

    // An admin successfully working this row via reinvite is the "unstick"
    // action -- clear stuck_at unconditionally (a no-op if it was never
    // set) so the candidate's dashboard stops showing the stuck card
    // forever. If the vendor also handed back a fresh magic link for this
    // call, cache it and flip the row back to "invited" so the candidate
    // has a working link too -- same field shape as the successful-write
    // branch in app/api/hub/interview/resume/route.ts. If it didn't (this
    // REINVITE-mode call's response shape doesn't guarantee one), just
    // clear stuck_at and leave status as-is rather than fabricating a link.
    const fresh = magicLinks?.[0];
    const { error: updateError } = await supabase
      .from("fitment_interviews")
      .update(
        fresh
          ? { stuck_at: null, status: "invited", magic_link: fresh.magicLink, magic_link_expires_at: fresh.expiresAt }
          : { stuck_at: null }
      )
      .eq("id", row.id);
    if (updateError) {
      console.error("Admin reinvite: failed to clear stuck_at on the row", { id, error: updateError });
    }

    return Response.json({ ok: true, invited });
  } catch (err) {
    console.error("Admin reinvite request failed", { id, error: err });
    return Response.json({ error: "IntervueBox rejected the reinvite request." }, { status: 502 });
  }
}
