import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { claimFitmentLeads } from "@/lib/claimFitmentLeads";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return Response.redirect(`${origin}/hub/login?error=expired`, 307);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return Response.redirect(`${origin}/hub/login?error=expired`, 307);
  }

  const { id: userId, email } = data.user;
  if (email) {
    try {
      await claimFitmentLeads(userId, email);
    } catch (err) {
      console.error("claimFitmentLeads failed during login", err);
      // Non-fatal — the user still gets their session and lands on
      // /hub/account; they just may not see a previously-anonymous
      // score attached this one time.
    }
  }

  return Response.redirect(`${origin}/hub/account`, 307);
}
