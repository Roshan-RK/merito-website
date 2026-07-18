import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getApplicant } from "@/lib/intervuebox/applicants";
import { createInterviewAgent } from "@/lib/intervuebox/agents";
import { sendInterviewInvitation } from "@/lib/intervuebox/invitations";

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

  const { data: existing } = await supabase
    .from("fitment_interviews")
    .select("status")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .maybeSingle();

  if (existing) {
    return Response.json({ status: existing.status === "ready" ? "ready" : "invited" });
  }

  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("ib_job_id, ib_applied_job_id")
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
  try {
    ({ candidateId } = await getApplicant(lead.ib_applied_job_id));
    ({ ibAgentId } = await createInterviewAgent(lead.ib_job_id));
    const { invited } = await sendInterviewInvitation(ibAgentId, [candidateId]);
    if (invited === 0) {
      console.error("IntervueBox interview-invite chain failed", {
        jobId: lead.ib_job_id,
        error: "sendInterviewInvitation reported zero invited",
      });
      return Response.json(
        { error: "Something went wrong starting your AI interview — please try again." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("IntervueBox interview-invite chain failed", { jobId: lead.ib_job_id, error: err });
    return Response.json(
      { error: "Something went wrong starting your AI interview — please try again." },
      { status: 500 }
    );
  }

  const admin = getSupabaseServerClient();
  const { error: insertError } = await admin.from("fitment_interviews").insert({
    user_id: user.id,
    role_title: roleTitle,
    ib_job_id: lead.ib_job_id,
    ib_agent_id: ibAgentId,
    ib_candidate_id: candidateId,
    status: "invited",
  });

  if (insertError) {
    return Response.json(
      { error: "Invitation sent, but we couldn't save the status — please refresh." },
      { status: 500 }
    );
  }

  return Response.json({ status: "invited" });
}
