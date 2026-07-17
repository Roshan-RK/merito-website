import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { unlockReport } from "@/lib/reportUnlocks";
import { generateFitmentReport } from "@/lib/generateFitmentReport";
import { getSupabaseServerClient } from "@/lib/supabase";

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

  const { data: lead, error: leadError } = await supabase
    .from("fitment_leads")
    .select("jd_text, cv_text, score")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leadError || !lead) {
    return Response.json({ error: "No fitment check found for this role." }, { status: 400 });
  }

  try {
    await unlockReport(user.id, roleTitle);
  } catch {
    return Response.json({ error: "Something went wrong unlocking the report." }, { status: 500 });
  }

  if (!lead.cv_text) {
    return Response.json({ status: "needs_cv" });
  }

  let report;
  try {
    report = await generateFitmentReport(lead.jd_text, lead.cv_text, lead.score);
  } catch {
    return Response.json({ error: "Unlocked, but the report failed to generate — please refresh." }, { status: 500 });
  }

  const admin = getSupabaseServerClient();
  const { error: reportError } = await admin.from("fitment_reports").upsert(
    {
      user_id: user.id,
      role_title: roleTitle,
      verdict_summary: report.verdictSummary,
      categories: report.categories,
      action_plan: report.actionPlan,
    },
    { onConflict: "user_id,role_title" }
  );

  if (reportError) {
    return Response.json({ error: "Unlocked, but the report failed to save — please refresh." }, { status: 500 });
  }

  return Response.json({ status: "unlocked", report });
}
