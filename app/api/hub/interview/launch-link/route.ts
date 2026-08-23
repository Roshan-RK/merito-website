import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import { reinviteInterviewCandidates } from "@/lib/intervuebox/invitations";
import { markInterviewStuck } from "@/lib/interviewStuck";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { leadId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  if (!leadId) {
    return Response.json({ error: "leadId is required." }, { status: 400 });
  }

  const admin = getSupabaseServerClient();
  const { data: row } = await admin
    .from("fitment_interviews")
    .select("id, status, ib_agent_id, ib_candidate_id, magic_link, magic_link_expires_at, has_resumed")
    .eq("user_id", user.id)
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return Response.json({ error: "No interview invite found." }, { status: 400 });
  }

  // Re-select fresh above (not a stale page-load value) -- if the sweep
  // flipped this row to terminated between page load and this click, don't
  // hand out a launch link for it; the UI should refresh and show the
  // terminated card's resume button instead.
  if (row.status !== "invited") {
    return Response.json({ error: "This interview is no longer awaiting a start. Please refresh." }, { status: 409 });
  }

  // Treat a null/missing expiry as expired rather than crashing on it. Once
  // a row has ever been resumed, never trust the cache -- vendor has been
  // observed returning the same (now-dead) token on a RESUME call, so a
  // cached link here could be silently dead. Always ask fresh instead.
  const stillValid =
    !row.has_resumed &&
    row.magic_link &&
    row.magic_link_expires_at &&
    new Date(row.magic_link_expires_at).getTime() > Date.now();
  if (stillValid) {
    return Response.json({ url: row.magic_link });
  }

  let reinviteResult: Awaited<ReturnType<typeof reinviteInterviewCandidates>>;
  try {
    // RESUME once this row has ever been resumed -- the default REINVITE
    // mode discards progress, which is fine for a never-started candidate
    // but would silently wipe a resumed candidate's saved progress.
    reinviteResult = await reinviteInterviewCandidates(
      row.ib_agent_id,
      [row.ib_candidate_id],
      row.has_resumed ? "RESUME" : "REINVITE"
    );
  } catch (err) {
    console.error("Hub launch-link reinvite request failed", { leadId, error: err });
    // A row that's already used its one resume and still fails has no
    // self-service path left -- mark it stuck so the dashboard shows the
    // dedicated card instead of the same "Start Interview" button forever.
    // A first-ever invite failing here is a normal transient error, not stuck.
    if (row.has_resumed) {
      await markInterviewStuck(admin, row.id);
    }
    return Response.json({ error: "IntervueBox rejected the reinvite request." }, { status: 502 });
  }
  const { magicLinks, errors } = reinviteResult;
  const fresh = magicLinks?.[0];
  if (!fresh) {
    // Surface the vendor's actual reason when it gave one (matches the
    // pattern in app/api/hub/interview/resume/route.ts) instead of masking
    // a real vendor-side rejection behind a generic retry message.
    const message = errors?.[0]?.error ?? "Couldn't get a fresh interview link. Please try again.";
    if (row.has_resumed) {
      await markInterviewStuck(admin, row.id);
    }
    return Response.json({ error: message }, { status: 502 });
  }

  const { error: cacheError } = await admin
    .from("fitment_interviews")
    .update({ magic_link: fresh.magicLink, magic_link_expires_at: fresh.expiresAt })
    .eq("id", row.id);
  if (cacheError) {
    // The candidate already has a valid vendor link -- don't fail the
    // request over a cache-write miss, just log it so a stale cached link
    // isn't a silent mystery later.
    console.error("Hub launch-link: failed to cache the fresh magic link", { leadId, error: cacheError });
  }

  return Response.json({ url: fresh.magicLink });
}
