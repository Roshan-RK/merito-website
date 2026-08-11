import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { convertProspectToLead } from "@/lib/prospectConversion";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!token_hash || !type) {
    return Response.redirect(`${origin}/claim/${token}?error=expired`, 307);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error || !data.user || !data.user.email) {
    return Response.redirect(`${origin}/claim/${token}?error=expired`, 307);
  }

  try {
    await convertProspectToLead(token, data.user.id, data.user.email);
  } catch (err) {
    console.error("convertProspectToLead failed during claim", err);
    return Response.redirect(`${origin}/claim/${token}?error=expired`, 307);
  }

  return Response.redirect(`${origin}/hub/account`, 307);
}
