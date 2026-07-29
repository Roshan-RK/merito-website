import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  if (!role) {
    return Response.json({ error: "role is required." }, { status: 400 });
  }

  const { data } = await supabase
    .from("fitment_interviews")
    .select("status")
    .eq("user_id", user.id)
    .eq("role_title", role)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return Response.json({ status: "not_started" });
  }

  return Response.json({ status: data.status === "ready" ? "ready" : "invited" });
}
