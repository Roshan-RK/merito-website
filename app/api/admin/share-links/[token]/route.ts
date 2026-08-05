import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { setShareLinkRevokedByToken } from "@/lib/reportShareTokens";

const PatchSchema = z.object({ revoked: z.boolean() });

type RouteContext = { params: Promise<{ token: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  await requireAdmin();

  const { token } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "revoked must be a boolean." }, { status: 400 });
  }

  await setShareLinkRevokedByToken(token, parsed.data.revoked);

  return Response.json({ ok: true });
}
