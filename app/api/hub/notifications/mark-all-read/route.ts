import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { markAllNotificationsRead } from "@/lib/hubNotifications";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  await markAllNotificationsRead(user.id);
  return Response.json({ ok: true });
}
