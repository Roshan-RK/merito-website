import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getApplicant } from "@/lib/intervuebox/applicants";
import { createInterviewAgent, type CandidateLevel } from "@/lib/intervuebox/agents";
import { sendInterviewInvitation } from "@/lib/intervuebox/invitations";
import { createJob } from "@/lib/intervuebox/jobs";

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
        { error: "Payment required to start a mock interview — please pay first." },
        { status: 402 }
      );
    }

    await admin
      .from("razorpay_transactions")
      .update({ consumed_at: new Date().toISOString() })
      .eq("order_id", credit.order_id);
  }

  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("ib_job_id, ib_applied_job_id, candidate_level, jd_text")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ error: "No fitment check found for this role." }, { status: 400 });
  }

  let candidateId: string;
  let ibAgentId: string;
  let ibJobId = lead.ib_job_id;
  try {
    ({ candidateId } = await getApplicant(lead.ib_applied_job_id));

    // IntervueBox permanently ties one interview to one job (vendor-
    // confirmed 2026-07-28 by Krupal) and won't re-invite a candidate who
    // already has a completed interview on an agent either — reusing the
    // agent silently 0-invites. A retake needs a genuinely new job. Vary
    // the JD text so IntervueBox's content-based job dedup doesn't collide
    // with the original job.
    const { data: priorAttempt } = await admin
      .from("fitment_interviews")
      .select("id")
      .eq("user_id", user.id)
      .eq("role_title", roleTitle)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (priorAttempt) {
      const retakeJD = `${lead.jd_text}\n\n(Retake attempt — ${new Date().toISOString()})`;
      ({ ibJobId } = await createJob({ title: roleTitle, jobDescription: retakeJD }));
    }

    const candidateLevel = (lead.candidate_level as CandidateLevel) || "mid";
    ({ ibAgentId } = await createInterviewAgent(ibJobId, roleTitle, candidateLevel));

    const { invited } = await sendInterviewInvitation(ibAgentId, [candidateId]);
    if (invited === 0) {
      console.error("IntervueBox interview-invite chain failed", {
        jobId: ibJobId,
        error: "sendInterviewInvitation reported zero invited",
      });
      return Response.json(
        { error: "Something went wrong starting your AI interview — please try again." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("IntervueBox interview-invite chain failed", { jobId: ibJobId, error: err });
    return Response.json(
      { error: "Something went wrong starting your AI interview — please try again." },
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
    return Response.json(
      { error: "Invitation sent, but we couldn't save the status — please refresh." },
      { status: 500 }
    );
  }

  return Response.json({ status: "invited" });
}
