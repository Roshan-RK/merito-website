import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getApplicant } from "@/lib/intervuebox/applicants";
import { createInterviewAgent, type CandidateLevel } from "@/lib/intervuebox/agents";
import { sendInterviewInvitation } from "@/lib/intervuebox/invitations";
import { recordPipelineFailure } from "@/lib/pipelineFailures";

export const runtime = "nodejs";

function isRazorpayBypassed(): boolean {
  return process.env.RAZORPAY_BYPASS !== "false";
}

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

  const { data: existing } = await supabase
    .from("fitment_interviews")
    .select("status")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .eq("status", "invited")
    .maybeSingle();

  if (existing) {
    return Response.json({ status: "invited" });
  }

  const admin = getSupabaseServerClient();

  // IntervueBox permanently ties one interview to one job (vendor-confirmed
  // 2026-07-28 by Krupal) and won't re-invite a candidate who already has a
  // completed interview on an agent — reusing the agent silently 0-invites.
  // A prior attempt tried working around this by spinning up a new job with
  // slightly-modified JD text, but still invited the OLD job's candidateId
  // to the NEW job's agent — IntervueBox scopes candidates per-job (they're
  // created via uploadResume+addApplicant against a specific job), so that
  // candidateId was never valid on the new job either. There's no cheap fix
  // without re-collecting the CV, so block instead of silently failing —
  // and check before the payment-credit consumption below so a blocked
  // attempt is never charged. role_title is the only link fitment_interviews
  // has back to an attempt (no lead_id FK), so this fires the same way
  // whether reached via a retake or via Change Target Role reusing the same
  // role title text.
  const { data: priorAttempt } = await admin
    .from("fitment_interviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (priorAttempt) {
    return Response.json(
      {
        error:
          "You've already completed an AI interview for this role. Each role can only be interviewed once. Change your target role to interview again.",
      },
      { status: 409 }
    );
  }

  let consumedOrderId: string | null = null;
  if (!isRazorpayBypassed()) {
    const { data: credit } = await admin
      .from("razorpay_transactions")
      .select("order_id")
      .eq("user_id", user.id)
      .eq("product", "interview")
      .eq("status", "success")
      .is("consumed_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!credit) {
      return Response.json(
        { error: "Payment required to start a mock interview. Please pay first." },
        { status: 402 }
      );
    }

    consumedOrderId = credit.order_id;
    await admin
      .from("razorpay_transactions")
      .update({ consumed_at: new Date().toISOString() })
      .eq("order_id", credit.order_id);
  }

  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("ib_job_id, ib_applied_job_id, candidate_level")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ error: "No fitment check found for this role." }, { status: 400 });
  }

  let candidateId: string | undefined;
  let ibAgentId: string | undefined;
  let magicLink: string | null = null;
  let magicLinkExpiresAt: string | null = null;
  let stage: "getApplicant" | "createInterviewAgent" | "sendInterviewInvitation" = "getApplicant";
  const ibJobId = lead.ib_job_id;

  // Payment was already consumed above (before this fallible chain runs, so
  // a candidate never sees "pay again" while we retry) — if the chain fails
  // here, the credit must be un-consumed so their next click is free, and
  // the failure recorded so ops isn't blind to it (previously this only hit
  // console.error, which is how a candidate ended up paying twice for zero
  // interviews with nobody noticing). kind is "interview_invite_failed", not
  // the "interview_invite_after_payment" kind used below after a genuinely
  // successful invite — that kind's admin "Retry interview" action assumes
  // the vendor invite already went through and just inserts a local row, so
  // reusing it here would let an admin mark a candidate "invited" when
  // IntervueBox was never actually confirmed to have sent anything.
  const userId = user.id;
  async function recordFailedInviteAttempt(detail: Record<string, unknown>) {
    await recordPipelineFailure({
      kind: "interview_invite_failed",
      userId,
      leadId: null,
      orderId: consumedOrderId,
      detail: { stage, roleTitle, ibJobId, candidateId, ibAgentId, ...detail },
    });
    if (consumedOrderId) {
      await admin.from("razorpay_transactions").update({ consumed_at: null }).eq("order_id", consumedOrderId);
    }
  }

  try {
    ({ candidateId } = await getApplicant(lead.ib_applied_job_id));

    stage = "createInterviewAgent";
    const candidateLevel = (lead.candidate_level as CandidateLevel) || "mid";

    ({ ibAgentId } = await createInterviewAgent(ibJobId, roleTitle, candidateLevel));

    stage = "sendInterviewInvitation";
    const inviteResult = await sendInterviewInvitation(ibAgentId, [candidateId]);
    const invited = inviteResult.invited;
    magicLink = inviteResult.magicLink;
    magicLinkExpiresAt = inviteResult.magicLinkExpiresAt;
    if (invited === 0) {
      console.error("IntervueBox interview-invite chain failed", {
        jobId: ibJobId,
        error: "sendInterviewInvitation reported zero invited",
      });
      await recordFailedInviteAttempt({ invited: 0 });
      return Response.json(
        { error: "Something went wrong starting your AI interview. Please try again." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("IntervueBox interview-invite chain failed", { jobId: ibJobId, error: err });
    await recordFailedInviteAttempt({ error: err instanceof Error ? err.message : String(err) });
    return Response.json(
      { error: "Something went wrong starting your AI interview. Please try again." },
      { status: 500 }
    );
  }

  const { error: insertError } = await admin.from("fitment_interviews").insert({
    user_id: user.id,
    role_title: roleTitle,
    ib_job_id: ibJobId,
    ib_agent_id: ibAgentId,
    ib_candidate_id: candidateId,
    status: "invited",
    magic_link: magicLink,
    magic_link_expires_at: magicLinkExpiresAt,
  });

  if (insertError) {
    // Postgres unique-violation on the partial (user_id, role_title) WHERE
    // status='invited' index — a realistic double-click race where two
    // concurrent requests both pass the "no existing row" check above. The
    // IntervueBox-side invite already succeeded (possibly twice) either way,
    // so treat this as an idempotent success: re-select the row a concurrent
    // request already inserted and return its status instead of failing.
    if (insertError.code === "23505") {
      const { data: existingRow } = await admin
        .from("fitment_interviews")
        .select("status")
        .eq("user_id", user.id)
        .eq("role_title", roleTitle)
        .eq("status", "invited")
        .maybeSingle();

      if (existingRow) {
        return Response.json({ status: "invited" });
      }
    }

    // IntervueBox-side records now exist with no Merito row pointing at
    // them — log the IDs so this can be manually traced and reconciled.
    console.error("fitment_interviews insert failed after IntervueBox invite chain succeeded", {
      ib_job_id: ibJobId,
      ib_agent_id: ibAgentId,
      ib_candidate_id: candidateId,
      error: insertError,
    });
    await recordPipelineFailure({
      kind: "interview_invite_after_payment",
      userId: user.id,
      leadId: null,
      orderId: consumedOrderId,
      detail: { roleTitle, ibJobId, ibAgentId, ibCandidateId: candidateId, error: insertError.message },
    });
    return Response.json(
      { error: "Invitation sent, but we couldn't save the status. Please refresh." },
      { status: 500 }
    );
  }

  return Response.json({ status: "invited" });
}
