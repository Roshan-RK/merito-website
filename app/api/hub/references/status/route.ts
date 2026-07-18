import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const status = await getReferenceCheckStatus(user.id);
  return Response.json(status);
}
