import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { setShareLinkRevokedByToken } from "@/lib/reportShareTokens";
import { logAdminAction } from "@/lib/adminAuditLog";

const PatchSchema = z.object({ revoked: z.boolean() });

type RouteContext = { params: Promise<{ token: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();

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

  try {
    await logAdminAction({
      adminEmail: admin.email as string,
      action: "share_link.set_revoked",
      targetType: "share_link",
      targetId: token,
      newValue: { revoked: parsed.data.revoked },
    });
  } catch (error) {
    console.error("Failed to log admin action share_link.set_revoked", { token, error });
  }

  return Response.json({ ok: true });
}
