import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { claimFitmentLeads } from "@/lib/claimFitmentLeads";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await request.formData();
  form.set("email", user.email);

  const { data: existingLead } = await supabase
    .from("fitment_leads")
    .select("name, phone, candidate_level")
    .eq("user_id", user.id)
    .not("phone", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingLead?.name) {
    form.set("name", existingLead.name);
  }

  if (existingLead?.phone) {
    form.set("phone", existingLead.phone);
  }

  if (existingLead?.candidate_level) {
    form.set("candidateLevel", existingLead.candidate_level);
  }

  const checkResponse = await fetch(new URL("/api/hub/fitment-check", request.url), {
    method: "POST",
    body: form,
  });
  const checkData = await checkResponse.json();

  if (!checkResponse.ok) {
    // fitment-check's duplicate message ("...Sign in to see your report.") is
    // written for the anonymous landing flow. Here the user is already
    // signed in and rescoring from their dashboard, so that copy is wrong —
    // rewrite it for this context instead of forwarding it verbatim.
    if (checkData.duplicate) {
      return Response.json(
        { ...checkData, error: "You've already checked your fitment for this exact role and CV — refresh the page to see the existing report." },
        { status: checkResponse.status }
      );
    }
    return Response.json(checkData, { status: checkResponse.status });
  }

  try {
    await claimFitmentLeads(user.id, user.email);
  } catch {
    // Non-fatal — the score was computed and stored; claiming can be
    // retried on next login if this fails, same tolerance Phase 1's
    // auth callback already applies to claiming.
  }

  return Response.json(checkData);
}
