import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { claimFitmentLeads } from "@/lib/claimFitmentLeads";

// Only known internal destinations are allowed — `next` is attacker-controlled
// input reflected into a redirect Location header, so anything not in this
// exact-match allowlist falls back to the default (no open redirect).
const ALLOWED_NEXT_PATHS = new Set(["/admin"]);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");
  const destination = next && ALLOWED_NEXT_PATHS.has(next) ? next : "/hub/account";

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

  return Response.redirect(`${origin}${destination}`, 307);
}
