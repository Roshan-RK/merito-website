import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { reinviteInterviewCandidates } from "@/lib/intervuebox/invitations";
import { logAdminAction } from "@/lib/adminAuditLog";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();

  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: row, error } = await supabase
    .from("fitment_interviews")
    .select("id, status, ib_agent_id, ib_candidate_id")
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
    // forever. This route's REINVITE-mode call reliably returns a fresh
    // magic link, so the fresh-branch below is the common case, not a rare
    // one -- and this action is exposed for every row regardless of status,
    // so it must never touch status/magic_link on a row whose interview is
    // already "ready": doing so would hide a scored, paid-for report behind
    // the "Start Interview" card again, the exact bug the stuck-state fix
    // was written to prevent, just reached through this route instead.
    // has_resumed: false is included because a fresh REINVITE-mode session
    // has genuinely never been resumed -- without it, launch-link's cached-
    // link check (which distrusts any cache once has_resumed is true) would
    // ignore the link just cached here and immediately re-call the vendor.
    const fresh = magicLinks?.[0];
    const shouldRelink = Boolean(fresh) && row.status !== "ready";
    const { error: updateError } = await supabase
      .from("fitment_interviews")
      .update(
        shouldRelink
          ? { stuck_at: null, status: "invited", magic_link: fresh!.magicLink, magic_link_expires_at: fresh!.expiresAt, has_resumed: false }
          : { stuck_at: null }
      )
      .eq("id", row.id);
    if (updateError) {
      console.error("Admin reinvite: failed to clear stuck_at on the row", { id, error: updateError });
    }

    try {
      await logAdminAction({
        adminEmail: admin.email as string,
        action: "interview.reinvite",
        targetType: "interview",
        targetId: id,
        priorValue: { status: row.status },
        newValue: { invited },
      });
    } catch (error) {
      console.error("Failed to log admin action interview.reinvite", { id, error });
    }

    return Response.json({ ok: true, invited });
  } catch (err) {
    console.error("Admin reinvite request failed", { id, error: err });
    return Response.json({ error: "IntervueBox rejected the reinvite request." }, { status: 502 });
  }
}
