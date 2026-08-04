import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { setShareLinkRevoked } from "@/lib/reportShareTokens";

export const runtime = "nodejs";

const BodySchema = z.object({
  roleTitle: z.string().trim().min(1),
  revoked: z.boolean(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  await setShareLinkRevoked({ userId: user.id, roleTitle: parsed.data.roleTitle, revoked: parsed.data.revoked });

  return Response.json({ ok: true });
}
