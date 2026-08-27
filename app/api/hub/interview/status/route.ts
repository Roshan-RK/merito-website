import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { reconcileInterviewRow } from "@/lib/intervuebox/reconcileInterviewRow";

// The candidate-facing statuses this route can return. Single source of truth
// for both the poll response and InterviewStatusPoller / pollInterviewStatus,
// so a caller can't compare against a value the route never emits (that was a
// real infinite-refresh bug once).
export type InterviewPollStatus =
  | "not_started"
  | "invited"
  | "appeared"
  | "terminated"
  | "stuck"
  | "ready";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("lead");
  if (!leadId) {
    return Response.json({ error: "lead is required." }, { status: 400 });
  }

  const { data } = await supabase
    .from("fitment_interviews")
    .select("id, status, role_title, ib_agent_id, ib_candidate_id, stuck_at")
    .eq("user_id", user.id)
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return Response.json({ status: "not_started" });
  }

  if (data.status === "ready") {
    return Response.json({ status: "ready" });
  }

  // Same per-row vendor reconciliation the cron sweep runs -- this poll is the
  // fallback for "still on the page waiting," so it catches a missed webhook
  // (READY), a vendor-side TERMINATED, or an APPEARED-then-idle row just as a
  // fresh page load would, not only on a sweep tick.
  const reconciled = await reconcileInterviewRow({
    id: data.id,
    user_id: user.id,
    role_title: data.role_title,
    ib_agent_id: data.ib_agent_id,
    ib_candidate_id: data.ib_candidate_id,
    status: data.status,
  });

  if (reconciled === "ready") return Response.json({ status: "ready" });
  if (reconciled === "terminated") return Response.json({ status: "terminated" });
  if (reconciled === "appeared") return Response.json({ status: "appeared" });

  // reconciled === "invited": still pending. Surface a stuck flag the same as
  // before -- a row can go stuck via launch-link while its status stays
  // "invited". See docs/superpowers/specs/2026-08-19-interview-stuck-state-design.md.
  if (data.stuck_at) {
    return Response.json({ status: "stuck" });
  }

  return Response.json({ status: "invited" });
}
