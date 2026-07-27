import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { claimFitmentLeads } from "@/lib/claimFitmentLeads";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!token_hash || !type) {
    return Response.redirect(`${origin}/hub/login?error=expired`, 307);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

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
