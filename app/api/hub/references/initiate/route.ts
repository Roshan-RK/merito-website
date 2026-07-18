import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { initiateReferenceCheck } from "@/lib/referenceChecks";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const { id } = await initiateReferenceCheck(user.id);
    return Response.json({ checkId: id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_ACTIVE") {
      return Response.json({ error: "You already have an active reference check." }, { status: 409 });
    }
    return Response.json({ error: "Something went wrong starting your reference check." }, { status: 500 });
  }
}
