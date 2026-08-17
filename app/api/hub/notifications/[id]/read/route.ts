import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { markNotificationRead } from "@/lib/hubNotifications";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  await markNotificationRead(id, user.id);
  return Response.json({ ok: true });
}
