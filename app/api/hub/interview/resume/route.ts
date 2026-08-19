import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import { reinviteInterviewCandidates } from "@/lib/intervuebox/invitations";

export const runtime = "nodejs";

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

  const admin = getSupabaseServerClient();
  const { data: row } = await admin
    .from("fitment_interviews")
    .select("id, status, ib_agent_id, ib_candidate_id")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return Response.json({ error: "No interrupted interview found for this role." }, { status: 400 });
  }

  let reinviteResult: Awaited<ReturnType<typeof reinviteInterviewCandidates>>;
  try {
    reinviteResult = await reinviteInterviewCandidates(row.ib_agent_id, [row.ib_candidate_id], "RESUME");
  } catch (err) {
    // The vendor client throws IntervueBoxError on any non-2xx HTTP response --
    // a different failure mode than the errors[] array below, which is the
    // vendor's 200-OK "business logic failure per candidate" shape (e.g.
    // "Cannot resume an interview in status EVALUATED"). Both are real and
    // must return clean JSON instead of crashing the route.
    console.error("Hub resume reinvite request failed", { roleTitle, error: err });
    return Response.json({ error: "IntervueBox rejected the reinvite request." }, { status: 502 });
  }

  const { magicLinks, errors } = reinviteResult;
  const fresh = magicLinks?.[0];

  if (!fresh) {
    // Surface the vendor's actual reason (e.g. "Cannot resume an interview
    // in status EVALUATED...") instead of a generic message -- matches this
    // codebase's existing pattern of surfacing real vendor/pipeline errors.
    const message = errors?.[0]?.error ?? "Couldn't resume this interview. Please try again.";
    return Response.json({ error: message }, { status: 502 });
  }

  // Reset ib_interview_status to null so a stale cached value doesn't
  // wrongly drive the appeared/invited split until the next sweep resyncs it.
  // has_resumed marks this row as "not safe to serve from cache" -- vendor
  // has been observed returning the same (now-dead) token on a RESUME call,
  // so once a row has ever been through here, launch-link must always ask
  // the vendor fresh instead of trusting magic_link_expires_at.
  const { error: resetError } = await admin
    .from("fitment_interviews")
    .update({
      status: "invited",
      magic_link: fresh.magicLink,
      magic_link_expires_at: fresh.expiresAt,
      ib_interview_status: null,
      has_resumed: true,
    })
    .eq("id", row.id);
  if (resetError) {
    // The candidate already has a valid vendor resume link -- don't fail the
    // request over a DB write miss, just log it so a row stuck showing
    // "terminated" after a real resume isn't a silent mystery later.
    console.error("Hub resume: failed to reset the row to invited", { roleTitle, error: resetError });
  }

  return Response.json({ url: fresh.magicLink });
}
