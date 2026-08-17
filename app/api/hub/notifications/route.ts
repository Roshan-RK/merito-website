import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getAllNotifications, getUnreadNotifications } from "@/lib/hubNotifications";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const [notifications, unread] = await Promise.all([
    getAllNotifications(user.id, 20),
    getUnreadNotifications(user.id),
  ]);

  return Response.json({ notifications, unreadCount: unread.length });
}
