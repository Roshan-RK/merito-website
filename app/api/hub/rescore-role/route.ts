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

  const checkResponse = await fetch(new URL("/api/hub/fitment-check", request.url), {
    method: "POST",
    body: form,
  });
  const checkData = await checkResponse.json();

  if (!checkResponse.ok) {
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
