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
    .select("id, status, ib_agent_id, ib_candidate_id, magic_link, magic_link_expires_at")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return Response.json({ error: "No interview invite found for this role." }, { status: 400 });
  }

  // Re-select fresh above (not a stale page-load value) -- if the sweep
  // flipped this row to terminated between page load and this click, don't
  // hand out a launch link for it; the UI should refresh and show the
  // terminated card's resume button instead.
  if (row.status !== "invited") {
    return Response.json({ error: "This interview is no longer awaiting a start. Please refresh." }, { status: 409 });
  }

  // Treat a null/missing expiry as expired rather than crashing on it.
  const stillValid = row.magic_link && row.magic_link_expires_at && new Date(row.magic_link_expires_at).getTime() > Date.now();
  if (stillValid) {
    return Response.json({ url: row.magic_link });
  }

  let reinviteResult: Awaited<ReturnType<typeof reinviteInterviewCandidates>>;
  try {
    reinviteResult = await reinviteInterviewCandidates(row.ib_agent_id, [row.ib_candidate_id]);
  } catch (err) {
    console.error("Hub launch-link reinvite request failed", { roleTitle, error: err });
    return Response.json({ error: "IntervueBox rejected the reinvite request." }, { status: 502 });
  }
  const fresh = reinviteResult.magicLinks?.[0];
  if (!fresh) {
    return Response.json({ error: "Couldn't get a fresh interview link. Please try again." }, { status: 502 });
  }

  const { error: cacheError } = await admin
    .from("fitment_interviews")
    .update({ magic_link: fresh.magicLink, magic_link_expires_at: fresh.expiresAt })
    .eq("id", row.id);
  if (cacheError) {
    // The candidate already has a valid vendor link -- don't fail the
    // request over a cache-write miss, just log it so a stale cached link
    // isn't a silent mystery later.
    console.error("Hub launch-link: failed to cache the fresh magic link", { roleTitle, error: cacheError });
  }

  return Response.json({ url: fresh.magicLink });
}
